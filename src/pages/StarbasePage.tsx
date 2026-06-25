export default function StarbasePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-stone-900">Starbase</h1>
        <span className="text-xs text-stone-400">NSF — прямая трансляция</span>
      </div>
      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-xl">
        <iframe
          src="https://www.youtube.com/embed/mhJRzQsLZGg?autoplay=1&rel=0&modestbranding=1"
          title="Starbase NSF Live"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </main>
  );
}
