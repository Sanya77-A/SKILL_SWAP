import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";

export default function NotFoundPage() {
  return (
    <div className="text-center py-24">
      <h1 className="font-heading text-6xl font-bold text-text-secondary">404</h1>
      <p className="text-xl text-text-secondary mt-4">Page not found</p>
      <Button asChild size="lg" className="mt-6">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
