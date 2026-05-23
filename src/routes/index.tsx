import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { Sparkles, MapPin, Calendar as CalIcon, Play, LogIn, LogOut, Trophy, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
...
          {/* Right: Admin Link */}
          <div className="flex-1 flex justify-end">
            <Link 
              to="/admin" 
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md transition hover:bg-white/20"
            >
              <Settings className="h-4 w-4 text-white/70" />
              <span className="hidden sm:inline text-xs font-bold text-white tracking-tight">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-6 pb-24 pt-10">
        {/* Hero / Dynamic Video Carousel */}
        <section className="relative overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
          <div className="aspect-[9/16] w-full overflow-hidden relative">
            {featuredReplays.length > 0 ? (
              featuredReplays.map((replay, idx) => (
                <div 
                  key={replay.id} 
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? "opacity-100" : "opacity-0"}`}
                >
                  <video
                    src={`${replay.video_url}#t=3.0`}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="absolute inset-0 brand-gradient opacity-20" />
            )}
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80" />
            
            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-end p-8 text-center pb-12">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white drop-shadow-lg">
                Seus lances <span className="brand-text">em loop.</span>
              </h1>
              <p className="mt-3 text-base text-white/80 leading-relaxed font-medium max-w-[280px]">
                Selecione a arena, escolha a quadra e reviva cada jogada.
              </p>
              
              <button
                onClick={toggleCheckIn}
                className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-6 py-5 text-base font-bold transition shadow-2xl ${
                  checkInAt
                    ? "bg-white/10 text-white backdrop-blur-md border border-white/20 hover:bg-white/20"
                    : "brand-gradient brand-glow animate-pulse-glow text-white hover:scale-[1.02]"
                }`}
              >
                {checkInAt ? <><LogOut className="h-5 w-5" /> Sair da quadra</> : <><LogIn className="h-5 w-5" /> Entrar em quadra</>}
              </button>
            </div>

            {/* Pagination Dots */}
            {featuredReplays.length > 1 && (
              <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
                {featuredReplays.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 transition-all duration-300 rounded-full ${idx === currentSlide ? "w-6 bg-brand-orange" : "w-1.5 bg-white/30"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Location selectors */}
        <section className="glass-card space-y-5 p-6 bg-white shadow-md border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
            <MapPin className="h-3.5 w-3.5" /> Localização
          </div>
          <div className="space-y-3">
            <Select value={arenaId} onChange={setArenaId} placeholder="Selecione a Arena">
              {arenas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
            <Select value={quadraId} onChange={setQuadraId} placeholder={arenaId ? "Selecione a Quadra" : "Escolha uma arena antes"} disabled={!arenaId}>
              {quadras.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
            </Select>
          </div>
        </section>

        {/* Filters */}
        <section className="glass-card space-y-5 p-6 bg-white shadow-md border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
            <CalIcon className="h-3.5 w-3.5" /> Filtros
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none transition focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
          />
          <div className="grid grid-cols-2 gap-4">
            <TimeInput label="De" value={startHour} onChange={setStartHour} />
            <TimeInput label="Até" value={endHour} onChange={setEndHour} />
          </div>
          {(date || startHour || endHour || checkInAt) && (
            <button
              onClick={() => { setDate(""); setStartHour(""); setEndHour(""); setCheckInAt(null); }}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-brand-orange hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </section>

        {/* Feed */}
        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-xl font-black text-gray-900">
              <Sparkles className="h-5 w-5 text-brand-orange" />
              Feed de Lances
            </h2>
            <span className="text-sm font-medium text-muted-foreground">{filtered.length} lances</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((r) => <ReplayCard key={r.id} replay={r} onReward={reward} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Select({
  value, onChange, placeholder, disabled, children,
}: { value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-border bg-muted px-4 py-3.5 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-brand-orange focus:ring-1 focus:ring-brand-orange disabled:opacity-40"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60">▾</div>
    </div>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted px-4 py-2.5 transition-colors focus-within:border-brand-orange">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent text-sm font-bold text-foreground outline-none"
      >
        <option value="">--:00</option>
        {Array.from({ length: 24 }).map((_, h) => (
          <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
        ))}
      </select>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card flex flex-col items-center gap-6 px-6 py-16 text-center bg-white shadow-md border border-gray-200">
      <div className="brand-gradient grid h-20 w-20 place-items-center rounded-full brand-glow shadow-lg transition-transform hover:scale-105">
        <Play className="h-9 w-9 fill-white text-white" />
      </div>
      <div className="max-w-[280px] space-y-2">
        <h3 className="text-lg font-black text-gray-900">Aguardando o lance...</h3>
        <p className="text-sm font-medium text-muted-foreground leading-relaxed">
          Aperte o botão na quadra e o seu replay aparecerá aqui em poucos segundos!
        </p>
      </div>
    </div>
  );
}
