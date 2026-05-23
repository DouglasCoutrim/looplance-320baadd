import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/arenas")({
  component: Arenas,
});

function Arenas() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Arenas</h1>
      <p>Manage your arenas here.</p>
    </div>
  );
}