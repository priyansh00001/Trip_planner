"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Wallet, X, Plus, Receipt, ArrowRight, UserPlus, Trash2, IndianRupee, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface BudgetDrawerProps {
  isOpen: boolean
  onClose: () => void
  plan: any
  onPlanUpdate: (updatedPlan: any) => Promise<void>
}

// Ensure default structure
function getBudgetData(plan: any) {
  return plan.budgetData || { participants: ["Me"], expenses: [] }
}

export default function BudgetDrawer({ isOpen, onClose, plan, onPlanUpdate }: BudgetDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "settle">("overview")
  
  const budgetData = getBudgetData(plan)
  
  // State for adding participant
  const [newParticipant, setNewParticipant] = useState("")
  
  // State for new expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expDesc, setExpDesc] = useState("")
  const [expAmount, setExpAmount] = useState("")
  const [expPaidBy, setExpPaidBy] = useState(budgetData.participants[0] || "Me")
  const [expSplitAmong, setExpSplitAmong] = useState<string[]>(budgetData.participants)

  // -- COMPUTATIONS --
  
  const totalSpent = useMemo(() => {
    return budgetData.expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0)
  }, [budgetData])

  const settlements = useMemo(() => {
    if (!budgetData || !budgetData.participants || budgetData.participants.length === 0) return []
    
    // 1. Calculate net balances
    const balances: Record<string, number> = {}
    budgetData.participants.forEach((p: string) => balances[p] = 0)
    
    budgetData.expenses.forEach((exp: any) => {
      // Safety check in case a participant was removed but still exists in an old expense
      if (balances[exp.paidBy] === undefined) balances[exp.paidBy] = 0
      balances[exp.paidBy] += exp.amount
      
      const splitAmount = exp.amount / exp.splitAmong.length
      exp.splitAmong.forEach((p: string) => {
        if (balances[p] === undefined) balances[p] = 0
        balances[p] -= splitAmount
      })
    })

    // 2. Separate into debtors (-) and creditors (+)
    const debtors = Object.keys(balances)
      .filter(p => balances[p] < -0.01)
      .map(p => ({ name: p, amount: -balances[p] }))
      .sort((a,b) => b.amount - a.amount)
      
    const creditors = Object.keys(balances)
      .filter(p => balances[p] > 0.01)
      .map(p => ({ name: p, amount: balances[p] }))
      .sort((a,b) => b.amount - a.amount)

    // 3. Match them up
    const results = []
    let i = 0
    let j = 0
    
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i]
      const creditor = creditors[j]
      
      const amount = Math.min(debtor.amount, creditor.amount)
      
      results.push({ from: debtor.name, to: creditor.name, amount })
      
      debtor.amount -= amount
      creditor.amount -= amount
      
      if (debtor.amount < 0.01) i++
      if (creditor.amount < 0.01) j++
    }
    
    return results
  }, [budgetData])

  // -- ACTIONS --

  const saveBudgetData = async (newData: any) => {
    await onPlanUpdate({
      ...plan,
      budgetData: newData
    })
  }

  const handleAddParticipant = () => {
    if (!newParticipant.trim()) return
    if (budgetData.participants.includes(newParticipant.trim())) return
    
    const newName = newParticipant.trim()
    const newData = {
      ...budgetData,
      participants: [...budgetData.participants, newName]
    }
    saveBudgetData(newData)
    setNewParticipant("")
    // Auto-select them in the new expense form
    setExpSplitAmong([...expSplitAmong, newName])
  }

  const handleAddExpense = () => {
    if (!expDesc || !expAmount || isNaN(Number(expAmount)) || expSplitAmong.length === 0) return
    
    const newExpense = {
      id: Math.random().toString(36).substr(2, 9),
      description: expDesc,
      amount: Number(expAmount),
      paidBy: expPaidBy,
      splitAmong: expSplitAmong,
      date: new Date().toISOString()
    }
    
    const newData = {
      ...budgetData,
      expenses: [...budgetData.expenses, newExpense]
    }
    
    saveBudgetData(newData)
    setShowExpenseForm(false)
    setExpDesc("")
    setExpAmount("")
  }

  const handleDeleteExpense = (id: string) => {
    const newData = {
      ...budgetData,
      expenses: budgetData.expenses.filter((e: any) => e.id !== id)
    }
    saveBudgetData(newData)
  }

  const toggleSplitter = (name: string) => {
    if (expSplitAmong.includes(name)) {
      setExpSplitAmong(expSplitAmong.filter(n => n !== name))
    } else {
      setExpSplitAmong([...expSplitAmong, name])
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm no-print"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-background shadow-2xl z-[9999] border-l flex flex-col no-print"
          >
            {/* Header */}
            <div className="p-5 border-b bg-muted/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold leading-tight text-xl">Trip Budget</h3>
                    <p className="text-sm text-muted-foreground tracking-tight">Track expenses & split costs</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex bg-muted p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "overview" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("expenses")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "expenses" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Expenses
                </button>
                <button
                  onClick={() => setActiveTab("settle")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "settle" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Settle Up
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5">
              
              {/* TAB: OVERVIEW */}
              {activeTab === "overview" && (() => {
                // Parse the base budget from strings like "₹25,000" or "25000"
                const cleanBudgetStr = plan.estimatedCost?.replace(/,/g, '') || ""
                const baseBudgetMatch = cleanBudgetStr.match(/\d+/)
                const baseBudget = baseBudgetMatch ? parseInt(baseBudgetMatch[0], 10) : 0
                const numPeople = budgetData.participants.length
                const groupBudget = baseBudget * numPeople

                return (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border border-emerald-500/20 rounded-2xl p-5 text-center relative overflow-hidden">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1 relative z-10">Total Group Spend</p>
                      <p className="text-4xl font-black mb-3 relative z-10">₹{totalSpent.toLocaleString('en-IN')}</p>
                      
                      {baseBudget > 0 && (
                        <div className="bg-emerald-500/10 rounded-lg p-2.5 mx-auto max-w-[280px] relative z-10 border border-emerald-500/20">
                          <p className="text-xs text-muted-foreground font-medium">
                            Group Budget: <strong className="text-foreground">₹{groupBudget.toLocaleString('en-IN')}</strong>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            (₹{baseBudget.toLocaleString('en-IN')} × {numPeople} people)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Participants */}
                  <div>
                    <h4 className="font-bold mb-3 flex items-center"><UserPlus className="h-4 w-4 mr-2 text-primary" /> Group Members</h4>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {budgetData.participants.map((p: string) => (
                        <div key={p} className="px-3 py-1.5 bg-muted rounded-full text-sm font-medium border">
                          {p}
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Add person (e.g. Rahul)" 
                        value={newParticipant}
                        onChange={(e) => setNewParticipant(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                        className="rounded-full"
                      />
                      <Button onClick={handleAddParticipant} variant="secondary" className="rounded-full shrink-0">Add</Button>
                    </div>
                    </div>
                  </motion.div>
                )
              })()}

              {/* TAB: EXPENSES */}
              {activeTab === "expenses" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {!showExpenseForm ? (
                    <>
                      <Button onClick={() => setShowExpenseForm(true)} className="w-full rounded-full mb-6 py-6 border-dashed border-2 bg-muted/50 text-foreground hover:bg-muted" variant="outline">
                        <Plus className="h-5 w-5 mr-2" /> Add New Expense
                      </Button>

                      {budgetData.expenses.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                          <Receipt className="h-10 w-10 mb-3 opacity-20" />
                          <p>No expenses logged yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {budgetData.expenses.slice().reverse().map((exp: any) => (
                            <div key={exp.id} className="p-4 rounded-xl border bg-card flex justify-between items-center group">
                              <div>
                                <h4 className="font-bold text-sm leading-tight">{exp.description}</h4>
                                <p className="text-xs text-muted-foreground mt-1">Paid by <strong>{exp.paidBy}</strong> for {exp.splitAmong.length} ppl</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-base">₹{exp.amount.toLocaleString('en-IN')}</span>
                                <button onClick={() => handleDeleteExpense(exp.id)} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    // Add Expense Form
                    <div className="space-y-4 bg-muted/30 p-5 rounded-2xl border">
                      <h4 className="font-bold text-lg mb-2">New Expense</h4>
                      
                      <div>
                        <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Description</label>
                        <Input placeholder="e.g. Dinner at Tito's" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Amount (₹)</label>
                        <Input type="number" placeholder="0" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Who Paid?</label>
                        <div className="flex flex-wrap gap-2">
                          {budgetData.participants.map((p: string) => (
                            <button
                              key={p}
                              onClick={() => setExpPaidBy(p)}
                              className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${expPaidBy === p ? 'bg-primary text-primary-foreground' : 'bg-background border hover:bg-muted'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Split Among</label>
                        <div className="flex flex-wrap gap-2">
                          {budgetData.participants.map((p: string) => {
                            const isSelected = expSplitAmong.includes(p)
                            return (
                              <button
                                key={p}
                                onClick={() => toggleSplitter(p)}
                                className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-background border hover:bg-muted opacity-50'}`}
                              >
                                {p}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button className="flex-1 rounded-full" onClick={handleAddExpense}>Save Expense</Button>
                        <Button variant="outline" className="rounded-full" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB: SETTLE UP */}
              {activeTab === "settle" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-800 dark:text-blue-300">
                    <p>This shows exactly who needs to pay whom to settle all debts. It automatically minimizes the total number of transactions.</p>
                  </div>

                  {settlements.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className="font-bold text-foreground">You're all settled up!</p>
                      <p className="text-sm">No one owes anything.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {settlements.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-rose-500">{s.from}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="font-bold text-emerald-500">{s.to}</span>
                          </div>
                          <div className="font-black text-lg">
                            ₹{Math.round(s.amount).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
