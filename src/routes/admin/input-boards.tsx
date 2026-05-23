import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/input-boards")({
  component: InputBoards,
});

function InputBoards() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Input Boards</h1>
      <p>Manage your USB Zero Delay boards here.</p>
    </div>
  );
}