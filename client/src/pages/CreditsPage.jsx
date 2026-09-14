import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDownRight, ArrowUpRight, Coins, ShieldCheck } from "lucide-react";
import { api } from "../utils/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";

const typeLabels = {
  teaching_reward: "Teaching reward", booking_spend: "Booking payment", booking_refund: "Booking refund",
  bonus: "Bonus", referral: "Referral", achievement: "Achievement", admin_adjustment: "Adjustment",
};

export default function CreditsPage() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [walletResponse, transactionResponse] = await Promise.all([
        api.get("/credits/wallet"), api.get("/credits/transactions", { params: { page, limit: 20 } }),
      ]);
      setWallet(walletResponse.data.data);
      setTransactions(transactionResponse.data.data || []);
      setPagination(transactionResponse.data.pagination || { page: 1, pages: 1 });
    } catch (error) { toast.error(error.response?.data?.message || "Could not load SkillCredits"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading && !wallet) return <p className="py-12 text-center text-text-secondary" role="status">Loading SkillCredits…</p>;
  return <div className="space-y-6"><header><h1 className="font-heading text-3xl font-bold text-text-primary">SkillCredits</h1><p className="mt-1 text-sm text-text-secondary">Your balance is backed by an immutable transaction ledger.</p></header><div className="grid gap-4 sm:grid-cols-3"><Card><CardContent><Coins className="mb-3 h-6 w-6 text-accent" /><p className="text-sm text-text-secondary">Available balance</p><p className="mt-1 font-heading text-3xl font-bold text-text-primary">{wallet?.balance || 0}</p></CardContent></Card><Card><CardContent><ArrowUpRight className="mb-3 h-6 w-6 text-accent-2" /><p className="text-sm text-text-secondary">Lifetime earned</p><p className="mt-1 font-heading text-2xl font-bold text-text-primary">{wallet?.ledgerEarned || 0}</p></CardContent></Card><Card><CardContent><ArrowDownRight className="mb-3 h-6 w-6 text-warning" /><p className="text-sm text-text-secondary">Lifetime spent</p><p className="mt-1 font-heading text-2xl font-bold text-text-primary">{wallet?.ledgerSpent || 0}</p></CardContent></Card></div><Card><CardContent><div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-lg font-semibold text-text-primary">Transaction ledger</h2><Badge variant={wallet?.integrityValid ? "success" : "warning"}><ShieldCheck className="mr-1 h-3.5 w-3.5" />{wallet?.integrityValid ? "Reconciled" : "Review pending"}</Badge></div>{transactions.length ? <div className="divide-y divide-border">{transactions.map((transaction) => <div key={transaction.transactionId} className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium text-text-primary">{typeLabels[transaction.type] || transaction.type}</p><p className="mt-1 text-xs text-text-secondary">{transaction.description} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.createdAt))}</p></div><div className="text-right"><p className={`font-semibold ${transaction.amount > 0 ? "text-accent-2" : "text-danger"}`}>{transaction.amount > 0 ? "+" : ""}{transaction.amount}</p><p className="text-xs text-text-secondary">Balance {transaction.balanceAfter}</p></div></div>)}</div> : <p className="py-10 text-center text-sm text-text-secondary">No credit transactions yet.</p>}{pagination.pages > 1 && <div className="mt-4 flex justify-end gap-2"><Button size="sm" variant="secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</Button></div>}</CardContent></Card></div>;
}
