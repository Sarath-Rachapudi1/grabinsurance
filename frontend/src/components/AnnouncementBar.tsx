export default function AnnouncementBar() {
  return (
    <div className="bg-red-700 text-white text-xs py-2 px-4 flex items-center justify-center gap-3">
      {/* Red dot indicator */}
      <span className="w-2 h-2 rounded-full bg-white opacity-80 flex-shrink-0" />
      <span className="font-medium">
        Rs 500 OFF On Domestic &amp; Rs 1000 OFF On International Flights
      </span>
      <a
        href="#"
        className="bg-white text-red-700 font-bold px-3 py-0.5 rounded-full text-[11px]
                   hover:bg-red-50 transition-colors flex-shrink-0"
      >
        BOOK NOW
      </a>
    </div>
  );
}
