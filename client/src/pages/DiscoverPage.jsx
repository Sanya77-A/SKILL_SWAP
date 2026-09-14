import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Star, Users } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { SmartMatches } from "../components/matches/SmartMatches";
import { InlineNotice } from "../components/ui/InlineNotice";
import { useSelector } from "react-redux";

const cleanParams = (values) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "" && value !== false && value != null));

function ListingCard({ listing }) {
  const content = <Card hover={!listing.isDemo} className="h-full"><CardContent className="h-full">
    <div className="mb-3 flex items-center justify-between gap-2"><Badge variant="accent">{listing.skill?.name}</Badge><span className="text-xs text-text-secondary">★ {listing.ratingAvg || "New"}</span></div>
    <h3 className="font-heading font-semibold text-text-primary">{listing.title}</h3>
    <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{listing.description}</p>
    <div className="mt-4 flex items-center gap-2"><Avatar src={listing.owner?.profilePhoto} name={listing.owner?.fullName || listing.owner?.name} size="sm" /><div><p className="text-sm text-text-primary">{listing.owner?.fullName || listing.owner?.name}</p><p className="text-xs text-text-secondary">{listing.owner?.headline}</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-secondary">
      {listing.exchangeEnabled && <span>Skill swap</span>}{listing.creditsEnabled && <span>{listing.creditCost} credits</span>}{listing.paidEnabled && <span>{listing.currency} {listing.price}</span>}
    </div>
  </CardContent></Card>;
  if (listing.isDemo) return <article className="h-full">{content}</article>;
  return (
    <Link to={`/listing/${listing._id}`} className="block h-full">
      {content}
    </Link>
  );
}

function MentorCard({ mentor }) {
  return (
    <Link to={mentor.isDemo ? `/demo/mentor/${mentor._id}` : `/@${mentor.username}`} className="block h-full">
      <Card hover className="h-full"><CardContent>
        <div className="flex items-center gap-3"><Avatar src={mentor.profilePhoto} name={mentor.fullName} size="lg" /><div><h3 className="font-medium text-text-primary">{mentor.fullName}</h3><p className="text-xs text-text-secondary">@{mentor.username}</p></div></div>
        <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{mentor.headline || mentor.bio || "SkillSwap member"}</p>
        <p className="mt-3 text-xs text-text-secondary"><Star className="mr-1 inline h-3.5 w-3.5 text-warning" />{mentor.ratingAvg || "New"} · SkillScore {mentor.skillScore || 0}</p>
      </CardContent></Card>
    </Link>
  );
}

function Section({ title, items, renderItem }) {
  if (!items?.length) return null;
  return <section><h2 className="mb-4 font-heading text-xl font-semibold text-text-primary">{title}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.slice(0, 4).map(renderItem)}</div></section>;
}

export default function DiscoverPage() {
  const isDemo = useSelector((state) => Boolean(state.auth.user?.isDemo));
  const [sections, setSections] = useState(null);
  const [results, setResults] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState({ q: "", category: "", skillId: "", ratingMin: "", proficiency: "", priceMin: "", priceMax: "", creditMax: "", deliveryMode: "", language: "", location: "", availability: "", verification: false, mentorExperience: "", experienceLevel: "", exchangeOnly: false, creditsOnly: false, paidOnly: false, sort: "best_match", page: 1, limit: 12 });

  useEffect(() => {
    if (isDemo) {
      api.get("/demo/explore").then(({ data }) => { setSections(data.data.sections); setCatalog(data.data.catalog || []); }).finally(() => setLoading(false));
      return;
    }
    Promise.all([api.get("/explore"), api.get("/skills", { params: { limit: 50, sort: "name", order: "asc" } })])
      .then(([sectionResponse, skillResponse]) => { setSections(sectionResponse.data.data); setCatalog(skillResponse.data.data || []); })
      .finally(() => setLoading(false));
  }, [isDemo]);

  const runSearch = useCallback(async (nextFilters = filters) => {
    setSearching(true);
    try {
      const response = await api.get(isDemo ? "/demo/explore" : "/explore/search", { params: cleanParams(nextFilters) });
      setResults(response.data.data);
    } finally {
      setSearching(false);
    }
  }, [filters, isDemo]);

  const submit = (event) => { event.preventDefault(); const next = { ...filters, page: 1 }; setFilters(next); runSearch(next); };
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const categories = [...new Set(catalog.map((skill) => skill.category))].sort();

  return (
    <div className="space-y-10">
      <header><h1 className="font-heading text-3xl font-bold text-text-primary">Explore SkillSwap</h1><p className="mt-1 text-sm text-text-secondary">Find skills, mentors, and offers across swaps, credits, and paid learning.</p></header>
      {isDemo ? <InlineNotice title="Demo marketplace">These mentors, listings, ratings, and availability details are deterministic fictional examples. No booking or exchange can be created.</InlineNotice> : <SmartMatches />}
      <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Search skills, mentors, or outcomes" placeholder="Search skills, mentors, or outcomes" value={filters.q} onChange={update("q")} /><Button type="submit" disabled={searching}><Search className="h-4 w-4" />{searching ? "Searching…" : "Search"}</Button><Button type="button" variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal className="h-4 w-4" />Filters</Button></div>
        {filtersOpen && <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Category" value={filters.category} onChange={update("category")} placeholder="All categories" options={categories} />
          <Select label="Skill" value={filters.skillId} onChange={update("skillId")} placeholder="All skills" options={catalog.map((skill) => ({ value: skill._id, label: skill.name }))} />
          <Select label="Minimum rating" value={filters.ratingMin} onChange={update("ratingMin")} placeholder="Any rating" options={[3, 4, 4.5].map(String)} />
          <Select label="Proficiency" value={filters.proficiency} onChange={update("proficiency")} placeholder="Any proficiency" options={["Beginner", "Intermediate", "Advanced", "Expert"]} />
          <Input label="Minimum price" type="number" min="0" value={filters.priceMin} onChange={update("priceMin")} />
          <Input label="Maximum price" type="number" min="0" value={filters.priceMax} onChange={update("priceMax")} />
          <Input label="Maximum credits" type="number" min="0" value={filters.creditMax} onChange={update("creditMax")} />
          <Select label="Delivery" value={filters.deliveryMode} onChange={update("deliveryMode")} placeholder="Any mode" options={[{ value: "online", label: "Online" }, { value: "in_person", label: "In person" }]} />
          <Input label="Language" value={filters.language} onChange={update("language")} />
          <Input label="Location" value={filters.location} onChange={update("location")} />
          <Input label="Availability" value={filters.availability} onChange={update("availability")} />
          <Select label="Learner level" value={filters.experienceLevel} onChange={update("experienceLevel")} placeholder="Any level" options={["beginner", "intermediate", "advanced", "expert", "all_levels"]} />
          <Select label="Sort" value={filters.sort} onChange={update("sort")} options={[
            { value: "best_match", label: "Best match" }, { value: "highest_rated", label: "Highest rated" },
            { value: "most_experienced", label: "Most experienced" }, { value: "lowest_price", label: "Lowest price" },
            { value: "most_active", label: "Most active" }, { value: "newest", label: "Newest" },
          ]} />
          <div className="flex flex-wrap items-end gap-4 pb-2 lg:col-span-3">{[
            ["verification", "Verified skills"], ["exchangeOnly", "Free swaps"], ["creditsOnly", "Credit sessions"], ["paidOnly", "Paid mentors"],
          ].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={filters[key]} onChange={update(key)} />{label}</label>)}</div>
        </div>}
      </form>

      {results ? <div className="space-y-10">
        <Section title={`Listings (${results.pagination.total})`} items={results.listings} renderItem={(listing) => <ListingCard key={listing._id} listing={listing} />} />
        <Section title="Mentors" items={results.mentors} renderItem={(mentor) => <MentorCard key={mentor._id} mentor={mentor} />} />
        <Section title="Skills" items={results.skills} renderItem={(skill) => <Card key={skill._id} className="p-5"><Badge variant="accent">{skill.category}</Badge><h3 className="mt-3 font-medium text-text-primary">{skill.name}</h3><p className="mt-1 line-clamp-2 text-sm text-text-secondary">{skill.description || "Explore mentors teaching this skill."}</p></Card>} />
        {!results.listings.length && !results.mentors.length && !results.skills.length && <Card className="p-12 text-center text-text-secondary">No results match these filters. Try widening the location, price, or delivery options.</Card>}
        {results.pagination.pages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="secondary" disabled={results.pagination.page <= 1} onClick={() => { const next = { ...filters, page: filters.page - 1 }; setFilters(next); runSearch(next); }}>Previous</Button><span className="text-sm text-text-secondary">Page {results.pagination.page} of {results.pagination.pages}</span><Button variant="secondary" disabled={results.pagination.page >= results.pagination.pages} onClick={() => { const next = { ...filters, page: filters.page + 1 }; setFilters(next); runSearch(next); }}>Next</Button></div>}
      </div> : loading ? <p className="py-12 text-center text-text-secondary" role="status">Building your marketplace…</p> : sections && <div className="space-y-10">
        <Section title="Recommended" items={sections.recommended} renderItem={(listing) => <ListingCard key={listing._id} listing={listing} />} />
        <Section title="Trending skills" items={sections.trendingSkills} renderItem={(skill) => <Card key={skill._id} className="p-5"><Badge variant="accent">{skill.category}</Badge><h3 className="mt-3 font-medium text-text-primary">{skill.name}</h3></Card>} />
        <Section title="Top mentors" items={sections.topMentors} renderItem={(mentor) => <MentorCard key={mentor._id} mentor={mentor} />} />
        <Section title="Recently active" items={sections.recentlyActive} renderItem={(mentor) => <MentorCard key={mentor._id} mentor={mentor} />} />
        <Section title="Beginner friendly" items={sections.beginnerFriendly} renderItem={(listing) => <ListingCard key={listing._id} listing={listing} />} />
        <Section title="Weekend availability" items={sections.weekendAvailability} renderItem={(mentor) => <MentorCard key={mentor._id} mentor={mentor} />} />
        <Section title="Nearby" items={sections.nearby} renderItem={(mentor) => <MentorCard key={mentor._id} mentor={mentor} />} />
        <Section title="Free skill swaps" items={sections.freeSkillSwaps} renderItem={(listing) => <ListingCard key={listing._id} listing={listing} />} />
        <Section title="Credit sessions" items={sections.creditSessions} renderItem={(listing) => <ListingCard key={listing._id} listing={listing} />} />
        <Section title="Paid mentors" items={sections.paidMentors} renderItem={(listing) => <ListingCard key={listing._id} listing={listing} />} />
        {!Object.values(sections).some((items) => items?.length) && <Card className="p-12 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-accent" /><p className="text-text-secondary">The marketplace is ready for its first published listings.</p></Card>}
      </div>}
    </div>
  );
}
