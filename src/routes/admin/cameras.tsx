import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/cameras")({
  component: Cameras,
});

function Cameras() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Cameras</h1>
      <p>Manage your cameras here.</p>
    </div>
  );
}