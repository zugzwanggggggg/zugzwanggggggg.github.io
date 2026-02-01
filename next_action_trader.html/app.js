const { createApp } = Vue;

createApp({
    data() {
        return {
            startCapital: 50000,
            targetProfitAmount: 55000, // +10%
            targetLossAmount: 47000,   // -6%
            dailyLossLimitPercent: 2.0, // 2% Daily Max ($1000)
            
            form: {
                date: new Date().toISOString().split('T')[0],
                rawPnl: null,
                comm: 0
            },
            trades: [],
            editingIndex: null
        }
    },
    computed: {
        calculatedNetPnl() {
            const raw = this.form.rawPnl || 0;
            const comm = this.form.comm || 0;
            return raw - comm;
        },
        totalPnL() {
            return this.trades.reduce((sum, t) => sum + t.netPnl, 0);
        },
        currentBalance() {
            return this.startCapital + this.totalPnL;
        },
        dailyPerformance() {
            const days = {};
            this.trades.forEach(t => {
                if (!days[t.date]) days[t.date] = 0;
                days[t.date] += t.netPnl;
            });
            return Object.keys(days).sort().map(date => ({
                date: date,
                pnl: days[date]
            }));
        },
        profitableDaysCount() {
            return this.dailyPerformance.filter(d => d.pnl > 250).length;
        },
        nextTradeData() {
            const history = this.dailyPerformance; 
            const balance = this.currentBalance;
            const capital = this.startCapital;

            // --- CONSTANTS ---
            const dailyMaxLossCash = capital * (this.dailyLossLimitPercent / 100); // $1000

            // --- STATE MACHINE ---
            let simDay = 1;      
            let simPath = "FRESH"; 

            // Thresholds
            const D1_TP_REQ = 4200; 
            const D1_SL_REQ = -950; // Threshold to consider it a "Full Loss" for the strategy step
            const D2_WIN_TP_REQ = 350; 
            const D2_LOSS_TP_REQ = 5000; 

            for (let i = 0; i < history.length; i++) {
                const pnl = history[i].pnl;

                if (simDay === 1) {
                    if (pnl >= D1_TP_REQ) {
                        simDay = 2;
                        simPath = "WIN_PATH";
                    } else if (pnl <= D1_SL_REQ) {
                        simDay = 2;
                        simPath = "LOSS_PATH";
                    } else {
                        // Range Bound -> Reset
                        simDay = 1;
                        simPath = "RANGE_RESET";
                    }
                }
                else if (simDay === 2) {
                    if (simPath === "WIN_PATH") {
                        if (pnl >= D2_WIN_TP_REQ) {
                            simDay = 3;
                            simPath = "WIN_STREAK";
                        } else {
                            simDay = 1;
                            simPath = "RESET";
                        }
                    } 
                    else if (simPath === "LOSS_PATH") {
                        if (pnl >= D2_LOSS_TP_REQ) {
                            simDay = 1; 
                            simPath = "RECOVERED";
                        } else if (pnl <= D1_SL_REQ) {
                            simDay = 3; 
                            simPath = "LOSS_STREAK";
                        } else {
                            simDay = 1;
                            simPath = "RANGE_RESET";
                        }
                    }
                }
                else if (simDay === 3) {
                    simDay = 1;
                    simPath = "RESET";
                }
            }

            // --- CALCULATE BASE TARGETS ---
            let dayLabel = `DAY ${simDay}`;
            let tpPercent = 0;
            let slPercent = 2.0; // Default base risk
            let reason = "";
            let displayPath = simPath === "RANGE_RESET" ? "RANGE DETECTED -> RESET" : simPath;

            if (simDay === 1) {
                tpPercent = 8.5;
                reason = "AIM FOR SL";
            }
            else if (simDay === 2) {
                if (simPath === "WIN_PATH") {
                    tpPercent = 0.75;
                    reason = "DAY 1 TP";
                } else {
                    tpPercent = 10.5;
                    reason = "DAY 1 SL";
                }
            }
            else if (simDay === 3) {
                if (simPath === "WIN_STREAK") {
                    reason = "DAY 2 TP";
                    const dist = Math.max(0, this.targetProfitAmount - balance);
                    tpPercent = (dist / capital) * 100;
                } else {
                    reason = "DAY 2 SL";
                    tpPercent = 12.5;
                }
            }

            // --- CRITICAL SL ADJUSTMENT ---
            // 1. Calculate Risk Cap based on Overall Loss ($47,000 Limit)
            const roomToOverallLoss = Math.max(0, balance - this.targetLossAmount);

            // 2. Calculate Risk Cap based on DAILY Loss ($1,000 Limit)
            // We look at the LAST DAY in history. If it was negative, we subtract that from today's allowance.
            // Note: This assumes the next trade is on the SAME day as the last logged trade.
            // If the last day was positive, full allowance is available.
            let usedDailyRisk = 0;
            if (history.length > 0) {
                const lastDayPnl = history[history.length - 1].pnl;
                if (lastDayPnl < 0) {
                    usedDailyRisk = Math.abs(lastDayPnl);
                }
            }

            const remainingDailyAllowance = Math.max(0, dailyMaxLossCash - usedDailyRisk);

            // 3. Determine Final Cash Risk
            // We take the smaller of: Base 2% vs. Overall Room vs. Daily Remaining
            let finalSlCash = (capital * slPercent) / 100; // The standard $1000
            
            // Clamp it
            finalSlCash = Math.min(finalSlCash, roomToOverallLoss, remainingDailyAllowance);
            
            // Recalculate % for display
            slPercent = (finalSlCash / capital) * 100;

            // Logic Reason Update if clamped
            if (remainingDailyAllowance < dailyMaxLossCash && remainingDailyAllowance > 0) {
                reason += " (PARTIAL DAILY RISK LEFT)";
            } else if (remainingDailyAllowance === 0) {
                reason = "DAILY STOP LOSS HIT. DO NOT TRADE.";
                tpPercent = 0;
                slPercent = 0;
                finalSlCash = 0;
            }

            return {
                dayLabel,
                path: displayPath,
                tpPercent: Number(tpPercent).toFixed(2),
                slPercent: Number(slPercent).toFixed(2),
                tpCash: (capital * tpPercent) / 100,
                slCash: finalSlCash,
                logicReason: reason
            };
        }
    },
    methods: {
        saveTrade() {
            if (this.form.rawPnl === null) return;
            const net = this.form.rawPnl - (this.form.comm || 0);
            const tradeData = {
                date: this.form.date,
                rawPnl: this.form.rawPnl,
                comm: this.form.comm,
                netPnl: net,
                id: Date.now()
            };
            if (this.editingIndex !== null) {
                this.trades[this.editingIndex] = tradeData;
                this.editingIndex = null;
            } else {
                this.trades.push(tradeData);
            }
            this.resetForm();
        },
        deleteTrade(index) {
            if(confirm("DELETE LOG ENTRY?")) {
                this.trades.splice(index, 1);
                if (this.editingIndex === index) this.cancelEdit();
            }
        },
        editTrade(index) {
            this.editingIndex = index;
            const t = this.trades[index];
            this.form.date = t.date;
            this.form.rawPnl = t.rawPnl;
            this.form.comm = t.comm;
        },
        cancelEdit() {
            this.editingIndex = null;
            this.resetForm();
        },
        resetForm() {
            this.form.rawPnl = null;
            this.form.comm = 0;
        },
        formatCurrency(val) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
        }
    }
}).mount('#app');