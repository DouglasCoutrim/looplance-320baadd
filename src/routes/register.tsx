import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";

export const Route = createFileRoute("/register")({
  component: RegisterRedirect,
  validateSearch: (search: Record<string, string>) => ({
    arena: search.arena ?? "",
  }),
});

function RegisterRedirect() {
  const { arena } = useSearch({ from: "/register" });

  if (!arena) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-black text-gray-900">Link inválido</h1>
          <p className="text-muted-foreground">
            Escaneie o QR code da arena para se cadastrar.
          </p>
        </div>
      </div>
    );
  }

  return <Navigate to="/auth" search={{ arena }} />;
}
