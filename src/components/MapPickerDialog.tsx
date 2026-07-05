/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Singleton Google Maps JS loader
let mapsLoaderPromise: Promise<typeof google> | null = null;
function loadMapsApi(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsLoaderPromise) return mapsLoaderPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Google Maps browser key ausente"));

  mapsLoaderPromise = new Promise((resolve, reject) => {
    const cbName = `__initGmaps_${Math.random().toString(36).slice(2)}`;
    (window as any)[cbName] = () => {
      resolve((window as any).google);
      delete (window as any)[cbName];
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=${cbName}${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoaderPromise;
}

// Geocode via the Lovable connector gateway (server-side APIs need the gateway).
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Try client-side first via a dynamically loaded Geocoder (works only if key allows it)
    // Fallback: return null. We keep the flow simple and rely on the JS API's Geocoder,
    // which uses the browser key (must be allowed for Geocoding in the referrer key).
    const google = await loadMapsApi();
    const geocoder = new google.maps.Geocoder();
    const res = await geocoder.geocode({ address });
    const loc = res.results?.[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    return null;
  }
}

export interface PickedLocation {
  lat: number;
  lng: number;
  cidade?: string | null;
  estado?: string | null; // UF sigla (2 letras)
  cep?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLat: number | null;
  initialLng: number | null;
  addressHint?: string;
  onConfirm: (loc: PickedLocation) => void;
}

async function reverseGeocode(lat: number, lng: number): Promise<Partial<PickedLocation>> {
  try {
    const google = await loadMapsApi();
    const geocoder = new google.maps.Geocoder();
    const res = await geocoder.geocode({ location: { lat, lng } });
    const result = res.results?.[0];
    if (!result) return {};
    let cidade: string | null = null;
    let estado: string | null = null;
    let cep: string | null = null;
    for (const comp of result.address_components) {
      const types = comp.types;
      if (types.includes("administrative_area_level_2") && !cidade) cidade = comp.long_name;
      else if (types.includes("locality") && !cidade) cidade = comp.long_name;
      if (types.includes("administrative_area_level_1")) estado = comp.short_name;
      if (types.includes("postal_code")) cep = comp.long_name;
    }
    return { cidade, estado, cep };
  } catch {
    return {};
  }
}

export function MapPickerDialog({ open, onOpenChange, initialLat, initialLng, addressHint, onConfirm }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPicked(initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null);

    (async () => {
      try {
        const google = await loadMapsApi();
        if (cancelled || !mapContainerRef.current) return;

        // Determine center
        let center = { lat: -14.235, lng: -51.9253 }; // Brasil
        let zoom = 4;
        if (initialLat != null && initialLng != null) {
          center = { lat: initialLat, lng: initialLng };
          zoom = 16;
        } else if (addressHint && addressHint.trim().length > 3) {
          const geo = await geocodeAddress(addressHint);
          if (!cancelled && geo) {
            center = geo;
            zoom = 15;
          }
        }
        if (cancelled) return;

        const map = new google.maps.Map(mapContainerRef.current, {
          center,
          zoom,
          disableDoubleClickZoom: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        // Existing marker
        if (initialLat != null && initialLng != null) {
          markerRef.current = new google.maps.Marker({
            position: { lat: initialLat, lng: initialLng },
            map,
            animation: google.maps.Animation.DROP,
          });
        }

        // Double-click adds / moves the pin
        map.addListener("dblclick", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          if (markerRef.current) {
            markerRef.current.setPosition(pos);
          } else {
            markerRef.current = new google.maps.Marker({
              position: pos,
              map,
              animation: google.maps.Animation.DROP,
            });
          }
          setPicked(pos);
        });

        setLoading(false);
      } catch (err: any) {
        toast.error(err?.message || "Erro ao carregar o mapa");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = async () => {
    if (!picked) {
      toast.error("Dê dois cliques no local desejado para marcar a arena");
      return;
    }
    const meta = await reverseGeocode(picked.lat, picked.lng);
    onConfirm({ lat: picked.lat, lng: picked.lng, ...meta });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-none shadow-2xl max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-orange" /> Selecionar localização
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-medium">
            Dê <strong>dois cliques</strong> no mapa para posicionar o pin da arena.
          </p>
        </DialogHeader>

        <div className="relative mt-4 mx-6 h-[420px] rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 text-brand-orange animate-spin" />
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        <div className="px-6 pt-3 pb-1 text-xs font-mono text-gray-600 min-h-[20px]">
          {picked ? (
            <>
              <span className="text-muted-foreground">Coordenadas: </span>
              {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
            </>
          ) : (
            <span className="italic text-gray-400">Nenhum pin ainda — dê dois cliques no mapa.</span>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!picked}
            className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12"
          >
            Confirmar Localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
