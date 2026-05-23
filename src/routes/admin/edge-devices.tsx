import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/edge-devices")({
  component: EdgeDevices,
});

function EdgeDevices() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Edge Devices</h1>
      <p>Manage your Edge Servers here.</p>
    </div>
  );
}