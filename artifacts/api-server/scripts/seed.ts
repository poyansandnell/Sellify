import { db, pool } from "@workspace/db";
import { categories, listings, profiles } from "@workspace/db/schema";

const cats = [
  { slug: "electronics", nameSv: "Elektronik", nameEn: "Electronics", icon: "smartphone" },
  { slug: "furniture", nameSv: "Möbler", nameEn: "Furniture", icon: "armchair" },
  { slug: "clothing", nameSv: "Kläder", nameEn: "Clothing", icon: "shirt" },
  { slug: "sports", nameSv: "Sport & fritid", nameEn: "Sports & Leisure", icon: "bike" },
  { slug: "home", nameSv: "Hem & inredning", nameEn: "Home & Decor", icon: "lamp" },
  { slug: "kids", nameSv: "Barn", nameEn: "Kids", icon: "baby" },
  { slug: "vehicles", nameSv: "Fordon", nameEn: "Vehicles", icon: "car" },
  { slug: "other", nameSv: "Övrigt", nameEn: "Other", icon: "tag" },
];

async function main() {
  const existing = await db.select().from(categories);
  if (existing.length === 0) {
    await db.insert(categories).values(cats);
  }
  const allCats = await db.select().from(categories);
  const byOrNull = (slug: string) => allCats.find((c) => c.slug === slug)?.id ?? null;

  const existingListings = await db.select().from(listings);
  if (existingListings.length > 0) {
    console.log("Listings already seeded, skipping");
    await pool.end();
    return;
  }

  const demoSellers = [
    { id: "seed_anna", displayName: "Anna Lindberg", city: "Stockholm", country: "SE" },
    { id: "seed_erik", displayName: "Erik Johansson", city: "Göteborg", country: "SE" },
    { id: "seed_maria", displayName: "Maria Svensson", city: "Malmö", country: "SE" },
  ];
  await db.insert(profiles).values(demoSellers).onConflictDoNothing();

  const rows = [
    {
      seller: "seed_anna", title: "Ljusgrå 3-sits soffa i tyg", cat: "furniture", price: "2800",
      img: "/seed/sofa.jpg", city: "Stockholm", condition: "good", brand: "IKEA",
      description: "Rymlig och bekväm 3-sitssoffa i ljusgrått tyg. Använd men i fint skick, inga fläckar eller skador. Klädseln är avtagbar och tvättbar.\n\nSäljes pga flytt. Måste hämtas på plats i Stockholm.",
      short: "Bekväm 3-sitssoffa i ljusgrått tyg, fint skick. Hämtas i Stockholm.",
    },
    {
      seller: "seed_erik", title: "Blå damcykel med korg, 7 växlar", cat: "sports", price: "1500",
      img: "/seed/bike.jpg", city: "Göteborg", condition: "good", brand: "Crescent",
      description: "Fin blå damcykel med korg fram och 7 växlar. Nyservad med nya bromsklossar. Rullar perfekt.\n\nKan provas på plats i Göteborg.",
      short: "Nyservad damcykel med korg och 7 växlar.",
    },
    {
      seller: "seed_maria", title: "iPhone 13 128GB svart", cat: "electronics", price: "4200",
      img: "/seed/iphone.jpg", city: "Malmö", condition: "like_new", brand: "Apple", model: "iPhone 13",
      description: "iPhone 13 med 128 GB i svart. Mycket fint skick, alltid haft skal och skärmskydd. Batterihälsa 89 %.\n\nLaddare och originalkartong ingår. Kan skickas spårbart.",
      short: "iPhone 13 128GB i mycket fint skick, batterihälsa 89 %.",
      shipping: "both",
    },
    {
      seller: "seed_anna", title: "Skinnjacka i brunt läder, strl M", cat: "clothing", price: "900",
      img: "/seed/jacket.jpg", city: "Stockholm", condition: "good",
      description: "Klassisk brun skinnjacka i äkta läder, storlek M. Snygg patina, mjukt skinn. Inga hål eller trasiga dragkedjor.\n\nKan skickas eller hämtas.",
      short: "Klassisk brun skinnjacka i äkta läder, strl M.",
      shipping: "both",
    },
    {
      seller: "seed_erik", title: "Vintage golvlampa i mässing", cat: "home", price: "650",
      img: "/seed/lamp.jpg", city: "Göteborg", condition: "good",
      description: "Vacker golvlampa i mässing från 60-talet med tygskärm. Fungerar perfekt, nytt eluttag monterat.\n\nHämtas i Göteborg.",
      short: "Vintage mässingslampa från 60-talet, fungerar perfekt.",
    },
    {
      seller: "seed_maria", title: "Barnvagn – svart/grå, komplett", cat: "kids", price: "1900",
      img: "/seed/stroller.jpg", city: "Malmö", condition: "good",
      description: "Komplett barnvagn i svart/grått med liggdel och sittdel. Normalt slitage men allt fungerar som det ska. Regnskydd och myggnät ingår.\n\nHämtas i Malmö.",
      short: "Komplett barnvagn med liggdel, sittdel och regnskydd.",
    },
    {
      seller: "seed_erik", title: "Alpinskidor 170 cm med stavar", cat: "sports", price: "1200",
      img: "/seed/skis.jpg", city: "Göteborg", condition: "fair",
      description: "Röda alpinskidor 170 cm inkl stavar. Vallade inför säsongen. Några repor på ovansidan men belag i bra skick.\n\nPerfekt startpaket för nybörjare.",
      short: "Alpinskidor 170 cm med stavar, vallade och åkklara.",
    },
    {
      seller: "seed_anna", title: "Skrivbord i ek med lådor", cat: "furniture", price: "1100",
      img: "/seed/desk.jpg", city: "Stockholm", condition: "good",
      description: "Stabilt skrivbord i massiv ek med tre lådor. Ytan har normalt slitage men inga större märken. Mått 120x60 cm.\n\nHämtas i Stockholm, kan bäras av två personer.",
      short: "Skrivbord i massiv ek med tre lådor, 120x60 cm.",
    },
  ];

  const slugify = (t: string) =>
    t.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) +
    "-" + Math.random().toString(36).slice(2, 8);

  await db.insert(listings).values(
    rows.map((r) => ({
      sellerId: r.seller,
      title: r.title,
      description: r.description,
      shortDescription: r.short,
      categoryId: byOrNull(r.cat),
      brand: (r as any).brand ?? null,
      model: (r as any).model ?? null,
      condition: r.condition,
      status: "active",
      price: r.price,
      currency: "SEK",
      priceType: "negotiable",
      city: r.city,
      country: "SE",
      shipping: (r as any).shipping ?? "pickup",
      images: [r.img],
      slug: slugify(r.title),
      seoTitle: r.title,
      seoDescription: r.short,
      viewCount: Math.floor(Math.random() * 120),
      publishedAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 86_400_000),
    })),
  );
  console.log("Seeded", rows.length, "listings and", cats.length, "categories");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
