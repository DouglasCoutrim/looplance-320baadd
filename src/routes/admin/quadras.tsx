import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/quadras")({
  component: Quadras,
});

function Quadras() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Courts</h1>
      <p>Manage your courts here.</p>
    </div>
  );
}