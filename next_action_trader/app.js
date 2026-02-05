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
            const raw = this.form.rawPnl;
            const comm = this.form.comm;
            if (raw === null || raw === "") return 0;
            return parseFloat(raw) - (parseFloat(comm) || 0);
        },
        totalPnL() {
            return this.trades.reduce((sum, t) => sum + t.netPnl, 0);
        },
        currentBalance() {
            return this.startCapital + this.totalPnL;
        },
        sortedTrades() {
            return [...this.trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        },
        displayTrades() {
            return [...this.sortedTrades].reverse();
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
            // "Profitable Day" must be > 0.5% of starting capital (0.5% of 50k = $250)
            return this.dailyPerformance.filter(d => d.pnl > 250).length;
        },
        nextTradeData() {
            const history = this.sortedTrades; 
            const balance = this.currentBalance;
            const capital = this.startCapital;

            // --- CONSTANTS ---
            const dailyMaxLossCash = capital * (this.dailyLossLimitPercent / 100); // $1,000
            const MIN_PROFITABLE_DAYS = 3;

            // Targets
            const D1_TP_TARGET = 4250; 
            const D1_SL_LIMIT  = -950; 

            // --- DETERMINE CURRENT DAY ---
            const dayCount = history.length + 1;
            let dayLabel = `DAY ${dayCount}`;
            
            let tpPercent = 0;
            let slPercent = 2.0; 
            let reason = "";
            let path = "";

            // --- CALCULATE ROOM ---
            const distProfit = Math.max(0, this.targetProfitAmount - balance);
            const distLoss = Math.max(0, balance - this.targetLossAmount);

            // --- STRATEGY SELECTOR ---
            
            // CHECK 1: ARE WE CLOSER TO PROFIT?
            if (distProfit < distLoss) {
                // We are in "Profit Territory", BUT have we met the day requirement?
                const daysCurrent = this.profitableDaysCount;

                if ((daysCurrent < MIN_PROFITABLE_DAYS) & ((this.targetProfitAmount - balance) < 500)) {
                    // *** GRIND MODE ***
                    // We are rich enough, but need more days. 
                    path = "DAY BUILDING";
                    reason = `NEED ${MIN_PROFITABLE_DAYS - daysCurrent} MORE PROFITABLE DAY(S).`;
                    tpPercent = 0.5;
                } else if ((daysCurrent < MIN_PROFITABLE_DAYS) & (balance < this.targetProfitAmount)) {
                    // TP first day, normal profit path
                    path = "DAY BUILDING - NORMAL PATH";
                    reason = `NEED ${MIN_PROFITABLE_DAYS - daysCurrent} MORE PROFITABLE DAY(S).`;
                    tpPercent = 0.75; 
                } 
                else {
                    // *** PROFIT ACCELERATION ***
                    // We have the money AND the days. Go for the kill.
                    path = "PROFIT ACCELERATION";
                    reason = "DAYS MET. AIM FOR FINAL TARGET.";
                    tpPercent = (distProfit / capital) * 100;
                }
            } 
            else {
                // Aim for SL
                // Follow the Day-by-Day Logic
                
                if (dayCount === 1) {
                    tpPercent = 8.5;
                    reason = "AIM FOR SL";
                    path = "FRESH START";
                }
                else if (dayCount === 2) {
                    const d1 = history[0].netPnl;
                    if (d1 >= D1_TP_TARGET) {
                        tpPercent = 0.75;
                        reason = "DAY 1 TP";
                        path = "WIN PATH";
                    } else {
                        tpPercent = 10.5;
                        if (d1 <= D1_SL_LIMIT) {
                             reason = "DAY 1 SL";
                             path = "LOSS PATH";
                        } else {
                             reason = "DAY 1 RANGE"; 
                             path = "RECOVERY PATH";
                        }
                    }
                }
                else if (dayCount === 3) {
                    const d1 = history[0].netPnl;
                    const d2 = history[1].netPnl;
                    const d1_Won = d1 >= D1_TP_TARGET;
                    const d2_Target = d1_Won ? 350 : 5000;
                    const d2_Won = d2 >= d2_Target;

                    if (d1_Won && d2_Won) {
                        reason = "DAY 2 TP";
                        path = "WIN STREAK";
                        // Even here, check days requirement
                        if (this.profitableDaysCount < MIN_PROFITABLE_DAYS) {
                             reason += " (ADD DAY)";
                             tpPercent = 0.75; // <--- UPDATED TO 0.75
                        } else {
                             tpPercent = (distProfit / capital) * 100;
                        }
                    } else {
                        path = "AGGRESSIVE RECOVERY";
                        tpPercent = 12.5;
                        if (d2 <= D1_SL_LIMIT) reason = "DAY 2 SL";
                        else reason = "DAY 2 RANGE";
                    }
                }
                else {
                    tpPercent = 12.5;
                    reason = "EXTENDED TRADING";
                    path = "GRINDING";
                }
            }

            // --- RISK MANAGEMENT ---
            const allowedDailyRisk = dailyMaxLossCash; 
            let finalSlCash = (capital * 2.0) / 100; 
            
            finalSlCash = Math.min(finalSlCash, distLoss, allowedDailyRisk);
            slPercent = (finalSlCash / capital) * 100;

            if (distLoss <= 0) {
                reason = "ACCOUNT MAX LOSS HIT. STOP.";
                tpPercent = 0;
                slPercent = 0;
                finalSlCash = 0;
            } else if (distProfit <= 0 && this.profitableDaysCount >= MIN_PROFITABLE_DAYS) {
                reason = "PROFIT TARGET HIT! CHALLENGE PASSED.";
                tpPercent = 0;
                slPercent = 0;
                finalSlCash = 0;
                path = "COMPLETED";
            }

            return {
                dayLabel,
                path,
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
            if (this.form.rawPnl === null || this.form.rawPnl === "") return;
            const raw = parseFloat(this.form.rawPnl);
            const comm = parseFloat(this.form.comm) || 0;
            const net = raw - comm;

            const tradeData = {
                date: this.form.date,
                rawPnl: raw,
                comm: comm,
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
            const tradeToDelete = this.displayTrades[index];
            const realIndex = this.trades.findIndex(t => t.id === tradeToDelete.id);
            
            if(confirm("DELETE LOG ENTRY?")) {
                if (realIndex !== -1) {
                    this.trades.splice(realIndex, 1);
                    if (this.editingIndex === realIndex) this.cancelEdit();
                }
            }
        },
        editTrade(index) {
            const tradeToEdit = this.displayTrades[index];
            const realIndex = this.trades.findIndex(t => t.id === tradeToEdit.id);
            
            this.editingIndex = realIndex;
            const t = this.trades[realIndex];
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
        },
        goToNextDay() {
            const d = new Date(this.form.date);
            d.setDate(d.getDate() + 1);
            this.form.date = d.toISOString().split('T')[0];
            this.resetForm();
        }
    }
}).mount('#app');