import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, Coins, Pause, Pencil, Plus, RefreshCw, Store, WalletCards } from "lucide-react";
import { api } from "../utils/api";
import { ListingEditor } from "../components/listings/ListingEditor";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";

const statusVariant = { published: "success", paused: "warning", archived: "danger", draft: "default" };

function ListingCard({ listing, mine, onEdit, onTransition }) {
  return (
    <Card hover className="h-full">
      <CardContent className="flex h-full flex-col">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Badge variant="accent">{listing.skill?.name}</Badge>
          {mine && <Badge variant={statusVariant[listing.status]}>{listing.status}</Badge>}
        </div>
        <h2 className="font-heading text-lg font-semibold text-text-primary">{listing.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm text-text-secondary">{listing.description}</p>
        {!mine && <p className="mt-3 text-sm text-text-secondary">By {listing.owner?.fullName || listing.owner?.name}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-secondary">
          {listing.exchangeEnabled && <span className="inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" />Swap</span>}
          {listing.creditsEnabled && <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" />{listing.creditCost} credits</span>}
          {listing.paidEnabled && <span className="inline-flex items-center gap-1"><WalletCards className="h-3.5 w-3.5" />{listing.currency} {listing.price}</span>}
        </div>
        <p className="mt-3 text-xs text-text-secondary">{listing.sessionDurations.join(" / ")} min · {listing.deliveryMode.join(", ").replaceAll("_", " ")}</p>
        {mine && listing.status !== "archived" && (
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant="secondary" onClick={() => onEdit(listing)}><Pencil className="h-4 w-4" />Edit</Button>
            {listing.status !== "published" && <Button size="sm" onClick={() => onTransition(listing, "publish")}>Publish</Button>}
            {listing.status === "published" && <Button size="sm" variant="secondary" onClick={() => onTransition(listing, "pause")}><Pause className="h-4 w-4" />Pause</Button>}
            <Button size="sm" variant="danger" onClick={() => onTransition(listing, "archive")}>Archive</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ListingsPage() {
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [teachingSkills, setTeachingSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mineResponse, marketResponse, skillsResponse] = await Promise.all([
        api.get("/listings/mine"), api.get("/listings", { params: { limit: 50 } }), api.get("/user-skills/me"),
      ]);
      setMine(mineResponse.data.data || []);
      setMarketplace(marketResponse.data.data || []);
      setTeachingSkills((skillsResponse.data.data || []).filter((record) => record.teachingEnabled && record.skill?.status === "active"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load listings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (payload) => {
    setSaving(true);
    try {
      if (editing) await api.patch(`/listings/${editing._id}`, payload);
      else await api.post("/listings", payload);
      toast.success(editing ? "Listing updated" : "Draft created");
      setEditorOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save listing");
    } finally {
      setSaving(false);
    }
  };

  const transition = async (listing, action) => {
    try {
      await api.post(`/listings/${listing._id}/${action}`);
      toast.success(`Listing ${action === "publish" ? "published" : action === "pause" ? "paused" : "archived"}`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update listing");
    }
  };

  const openEditor = (listing = null) => {
    setEditing(listing);
    setEditorOpen(true);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-heading text-3xl font-bold text-text-primary">Teaching listings</h1><p className="mt-1 text-sm text-text-secondary">Package your expertise for swaps, credits, or paid sessions.</p></div>
        <Button onClick={() => openEditor()}><Plus className="h-4 w-4" />Create listing</Button>
      </div>
      <Tabs value={tab} onChange={setTab}>
        <TabsList className="mb-6"><TabsTrigger value="mine">My listings</TabsTrigger><TabsTrigger value="marketplace">Marketplace</TabsTrigger></TabsList>
        {loading ? <p className="py-12 text-center text-text-secondary" role="status">Loading listings…</p> : (
          <>
            <TabsContent value="mine">
              {mine.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{mine.map((listing) => <ListingCard key={listing._id} listing={listing} mine onEdit={openEditor} onTransition={transition} />)}</div> : <Card className="p-12 text-center"><Store className="mx-auto mb-3 h-8 w-8 text-accent" /><p className="font-medium text-text-primary">Create your first teaching listing</p><p className="mt-1 text-sm text-text-secondary">Draft safely, preview the offer, then publish when it is ready.</p></Card>}
            </TabsContent>
            <TabsContent value="marketplace">
              {marketplace.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{marketplace.map((listing) => <ListingCard key={listing._id} listing={listing} />)}</div> : <Card className="p-12 text-center"><BookOpen className="mx-auto mb-3 h-8 w-8 text-accent" /><p className="text-text-secondary">No published listings yet.</p></Card>}
            </TabsContent>
          </>
        )}
      </Tabs>
      <Modal open={editorOpen} onClose={() => { setEditorOpen(false); setEditing(null); }} title={editing ? "Edit listing" : "Create listing"} size="lg">
        <ListingEditor listing={editing} teachingSkills={teachingSkills} onSubmit={save} saving={saving} />
      </Modal>
    </div>
  );
}
