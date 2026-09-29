/**
 * The facility's starting catalogue: sports, courts, rental equipment, amenities, café menu
 * and coaching adverts, plus the academy's internal programs and membership plans. Shared by
 * the demo seed and the production first-run setup so a fresh deployment has a working public
 * site. Everything here can be edited later from the admin dashboard.
 */
import type { coachingAds, courts, equipmentItems, facilities, foodItems, membershipPlans, programs, sports } from "../../src/server/db/schema";

const rupees = (n: number) => n * 100;

export const SPORTS: (typeof sports.$inferInsert)[] = [
  {
    slug: "badminton", name: "Badminton", sortOrder: 1,
    tagline: "Two BWF-spec wooden courts with glare-free lighting.",
    description: "Full-size courts on a cushioned synthetic mat over sprung wood, with 9 m clear height and side-mounted LED lighting that stays out of the shuttle's flight path.",
  },
  {
    slug: "pickleball", name: "Pickleball", sortOrder: 2,
    tagline: "Dedicated courts for the fastest-growing racket sport.",
    description: "Two permanent pickleball courts with regulation lines, portable nets and a textured acrylic surface that plays consistently for singles and doubles.",
  },
  {
    slug: "basketball", name: "Basketball", sortOrder: 3,
    tagline: "A full-size indoor court for games, training and events.",
    description: "A 28 × 15 m hardwood court with adjustable glass backboards, FIBA markings and a scoreboard — bookable for pickup games, team practice and tournaments.",
  },
];

/** Courts reference their sport by slug; the seed/setup resolves it to the sport id. */
export const COURTS: (Omit<typeof courts.$inferInsert, "sportId"> & { sport: string })[] = [
  {
    sport: "badminton", name: "Badminton Court 1", sortOrder: 1, surface: "4.5 mm PU mat on wooden sub-floor",
    description: "Main court beside the viewing gallery.", hourlyRate: rupees(500), peakHourlyRate: rupees(700),
    durations: [60, 120], bookingTypes: ["SINGLE", "MONTHLY", "QUARTERLY"],
  },
  {
    sport: "badminton", name: "Badminton Court 2", sortOrder: 2, surface: "4.5 mm PU mat on wooden sub-floor",
    description: "Training court with shuttle-launcher mount.", hourlyRate: rupees(500), peakHourlyRate: rupees(700),
    durations: [60, 120], bookingTypes: ["SINGLE", "MONTHLY", "QUARTERLY"],
  },
  {
    sport: "pickleball", name: "Pickleball Court 1", sortOrder: 3, surface: "Textured acrylic hard court",
    description: "Permanent lines and net, ideal for doubles.", hourlyRate: rupees(600), peakHourlyRate: rupees(800),
    durations: [60, 120], bookingTypes: ["SINGLE", "MONTHLY", "QUARTERLY"],
  },
  {
    sport: "pickleball", name: "Pickleball Court 2", sortOrder: 4, surface: "Textured acrylic hard court",
    description: "Next to the café lounge.", hourlyRate: rupees(600), peakHourlyRate: rupees(800),
    durations: [60, 120], bookingTypes: ["SINGLE", "MONTHLY"],
  },
  {
    sport: "basketball", name: "Basketball Court", sortOrder: 5, surface: "Maple hardwood",
    description: "Full-size indoor court with scoreboard.", hourlyRate: rupees(1500), peakHourlyRate: rupees(2000),
    durations: [60, 120], bookingTypes: ["SINGLE", "MONTHLY", "QUARTERLY"],
  },
];

/** `sport` = sport slug, or null for items shared across sports. */
export const EQUIPMENT: (Omit<typeof equipmentItems.$inferInsert, "sportId"> & { sport: string | null })[] = [
  { sport: "badminton", name: "Badminton racket", category: "Racket", size: "Standard (G4)", description: "Yonex Nanoflare graphite racket, freshly strung.", totalQuantity: 16, rentalPrice: rupees(60), pricing: "PER_BOOKING", deposit: rupees(500), sortOrder: 1 },
  { sport: "badminton", name: "Feather shuttles (tube of 6)", category: "Shuttles", description: "Match-grade feather shuttles. Charged per tube used.", totalQuantity: 40, rentalPrice: rupees(180), pricing: "PER_BOOKING", sortOrder: 2 },
  { sport: "badminton", name: "Nylon shuttles (tube of 6)", category: "Shuttles", description: "Durable nylon shuttles for practice.", totalQuantity: 30, rentalPrice: rupees(80), pricing: "PER_BOOKING", sortOrder: 3 },
  { sport: "pickleball", name: "Pickleball paddle", category: "Paddle", size: "Standard", description: "Carbon-face paddle with a polymer honeycomb core.", totalQuantity: 16, rentalPrice: rupees(80), pricing: "PER_BOOKING", deposit: rupees(500), sortOrder: 4 },
  { sport: "pickleball", name: "Pickleballs (set of 3)", category: "Balls", description: "Indoor 26-hole balls.", totalQuantity: 20, rentalPrice: rupees(40), pricing: "PER_BOOKING", sortOrder: 5 },
  { sport: "basketball", name: "Basketball", category: "Ball", size: "Size 7", description: "Composite leather indoor ball.", totalQuantity: 10, rentalPrice: rupees(100), pricing: "PER_BOOKING", deposit: rupees(500), sortOrder: 6 },
  { sport: "basketball", name: "Training bibs (set of 10)", category: "Bibs", description: "Two colours, five of each.", totalQuantity: 4, rentalPrice: rupees(150), pricing: "PER_BOOKING", sortOrder: 7 },
  { sport: null, name: "Sports towel", category: "Accessories", description: "Fresh cotton towel, returned at the desk.", totalQuantity: 40, rentalPrice: rupees(30), pricing: "PER_BOOKING", sortOrder: 8 },
];

/** Amenities (the sports themselves come from the sports and courts tables). */
export const FACILITIES: (typeof facilities.$inferInsert)[] = [
  { category: "EQUIPMENT", name: "Equipment rental desk", description: "Rackets, paddles, balls and towels to rent with your booking or at the front desk.", availability: "Every day · 6 AM – 10 PM", sortOrder: 1 },
  { category: "EQUIPMENT", name: "Racket stringing", description: "Same-day restringing with a choice of strings and tensions.", availability: "Drop off before 2 PM", price: rupees(350), sortOrder: 2 },
  { category: "FOOD_BEVERAGE", name: "Courtside café", description: "Fresh juices, shakes, coffee and light meals, with seating overlooking the courts.", availability: "Every day · 7 AM – 10 PM", sortOrder: 3 },
  { category: "AMENITY", name: "Changing rooms & showers", description: "Separate men's and women's changing rooms with hot showers.", availability: "During opening hours", sortOrder: 4 },
  { category: "AMENITY", name: "Lockers", description: "Day-use lockers with your own padlock or a rented one from the desk.", availability: "80 lockers", sortOrder: 5 },
  { category: "AMENITY", name: "Parking", description: "Free gated parking with CCTV for cars and two-wheelers.", availability: "30 cars · 60 two-wheelers", sortOrder: 6 },
  { category: "AMENITY", name: "Spectator seating", description: "Raised seating with a clear view of every court.", availability: "60 seats", sortOrder: 7 },
  { category: "AMENITY", name: "Drinking water & first aid", description: "Chilled RO water stations on the floor and a first-aid kit at the desk.", availability: "Always available", sortOrder: 8 },
  { category: "AMENITY", name: "Wi-Fi", description: "Free Wi-Fi in the lounge and café.", availability: "Ask the front desk", sortOrder: 9 },
];

export const FOOD_ITEMS: (typeof foodItems.$inferInsert)[] = [
  { category: "Beverages", name: "Fresh lime soda", description: "Sweet, salted or mixed.", price: rupees(60), sortOrder: 1 },
  { category: "Beverages", name: "Tender coconut water", price: rupees(70), sortOrder: 2 },
  { category: "Beverages", name: "Electrolyte drink", description: "Chilled, sugar-light.", price: rupees(50), sortOrder: 3 },
  { category: "Beverages", name: "Cold coffee", price: rupees(110), sortOrder: 4 },
  { category: "Beverages", name: "Masala chai", price: rupees(30), sortOrder: 5 },
  { category: "Shakes & smoothies", name: "Banana peanut-butter shake", price: rupees(140), sortOrder: 6 },
  { category: "Shakes & smoothies", name: "Whey protein shake", description: "Chocolate or vanilla, with milk or water.", price: rupees(160), sortOrder: 7 },
  { category: "Shakes & smoothies", name: "Mixed berry smoothie", price: rupees(150), sortOrder: 8 },
  { category: "Snacks", name: "Energy bar", price: rupees(60), sortOrder: 9 },
  { category: "Snacks", name: "Roasted makhana", price: rupees(70), sortOrder: 10 },
  { category: "Snacks", name: "Fruit bowl", description: "Seasonal cut fruit.", price: rupees(90), sortOrder: 11 },
  { category: "Light meals", name: "Grilled paneer sandwich", price: rupees(140), sortOrder: 12 },
  { category: "Light meals", name: "Poha", description: "Made fresh every morning until 11 AM.", price: rupees(60), sortOrder: 13 },
  { category: "Light meals", name: "Chicken wrap", price: rupees(170), sortOrder: 14 },
];

/** Coaching adverts. `coachSlug` links a coach when coaches exist (demo data). */
export const COACHING_ADS: (Omit<typeof coachingAds.$inferInsert, "sportId" | "coachId"> & { sport: string; coachSlug?: string })[] = [
  {
    slug: "badminton-foundations", sport: "badminton", coachSlug: "sagar-thakur", sortOrder: 1,
    title: "Badminton Foundations", summary: "Grips, footwork and the four core strokes in small, friendly groups.",
    description: "A structured starting point for new players. Sessions cover grip and ready position, six-corner footwork, the clear, drop, smash and serve, and the rules of singles and doubles — with plenty of rallying.",
    skillLevel: "Beginner", ageRange: "13+ and adults", timing: "Tue · Thu · Sat, 7–8 AM", ctaLabel: "Enquire now",
    highlights: ["Maximum 12 players per coach", "Rackets and shuttles provided", "Monthly progress check"],
  },
  {
    slug: "junior-badminton", sport: "badminton", coachSlug: "meera-iyer", sortOrder: 2,
    title: "Junior Badminton", summary: "Coordination, racket skills and confidence for young players.",
    description: "Movement games, racket control and basic technique taught through play — building discipline and a love for the sport.",
    skillLevel: "All levels", ageRange: "6–12 years", timing: "Mon–Fri, 3:30–4:30 PM · Weekends, 8–10 AM", ctaLabel: "Enquire now",
    highlights: ["Maximum 10 children per coach", "Parent updates every month", "Term-end mini tournament"],
  },
  {
    slug: "competitive-squad", sport: "badminton", coachSlug: "vikram-joshi", sortOrder: 3,
    title: "Competitive Squad", summary: "High-intensity training for district, state and ranking tournaments.",
    description: "Tactical video review, periodised conditioning, match simulation and individual tournament planning for committed players. Entry is by assessment.",
    skillLevel: "Advanced", ageRange: "11–25 years", timing: "Mon–Sat, 6–8 AM", ctaLabel: "Book an assessment",
    highlights: ["Video analysis every fortnight", "Strength & conditioning plan", "Tournament calendar support"],
  },
  {
    slug: "pickleball-clinic", sport: "pickleball", coachSlug: "rahul-dsouza", sortOrder: 4,
    title: "Pickleball Starter Clinic", summary: "Learn the dink, the third-shot drop and kitchen rules in four evenings.",
    description: "A four-session clinic for newcomers and tennis or badminton players switching over. Paddles and balls are provided.",
    skillLevel: "Beginner", ageRange: "15+ and adults", timing: "Wed & Fri, 7–8 PM", ctaLabel: "Enquire now",
    highlights: ["Four sessions", "Paddles provided", "Doubles strategy basics"],
  },
  {
    slug: "basketball-skills", sport: "basketball", coachSlug: "karan-mehta", sortOrder: 5,
    title: "Basketball Skills Academy", summary: "Ball handling, shooting mechanics and team play for young athletes.",
    description: "Progressive skill blocks with small-sided games and conditioning, grouped by age and ability.",
    skillLevel: "Beginner to intermediate", ageRange: "10–18 years", timing: "Sat & Sun, 7–9 AM", ctaLabel: "Enquire now",
    highlights: ["Shooting form analysis", "Game-based learning", "Quarterly showcase games"],
  },
];

/** `coachSlug` links a program to its lead coach when coaches exist (demo data). */
export const PROGRAMS: (Omit<typeof programs.$inferInsert, "coachId"> & { coachSlug?: string })[] = [
  {
    slug: "beginner", name: "Beginner Program", level: "BEGINNER", sortOrder: 1,
    tagline: "From first grip to first real rally.",
    description: "For students learning badminton fundamentals: grips, ready position, basic footwork, the four core strokes and the rules of the game. Small groups, lots of repetition and a coach who celebrates every clean clear.",
    ageGroup: "13+ years & adults", frequency: "3 sessions / week", sessionDuration: "60 min", programLength: "12 weeks",
    coachSlug: "sagar-thakur", monthlyFee: rupees(2200),
    highlights: ["Grip & stance fundamentals", "Six-corner footwork basics", "Clear, drop, smash & serve", "Monthly skill assessment"],
  },
  {
    slug: "intermediate", name: "Intermediate Program", level: "INTERMEDIATE", sortOrder: 2,
    tagline: "Consistency, movement and smarter shot selection.",
    description: "For players developing consistency, movement and technique. Multi-shuttle feeding, structured footwork patterns, net play and introduction to singles & doubles tactics with regular match-play.",
    ageGroup: "12+ years", frequency: "4 sessions / week", sessionDuration: "90 min", programLength: "16 weeks",
    coachSlug: "aditya-rane", monthlyFee: rupees(2900),
    highlights: ["Multi-shuttle technique blocks", "Split-step & recovery patterns", "Doubles rotation basics", "Fortnightly match-play"],
  },
  {
    slug: "advanced", name: "Advanced Program", level: "ADVANCED", sortOrder: 3,
    tagline: "Competitive training for tournament players.",
    description: "For competitive players targeting district, state and ranking tournaments. High-intensity sessions with tactical video review, periodised S&C, match simulation and individual tournament planning.",
    ageGroup: "11–25 years (by selection)", frequency: "6 sessions / week", sessionDuration: "120 min", programLength: "Season-long",
    coachSlug: "vikram-joshi", monthlyFee: rupees(3900),
    highlights: ["Tactical video analysis", "Periodised strength & conditioning", "Tournament calendar planning", "1-on-1 monthly review"],
  },
  {
    slug: "kids", name: "Kids Program", level: "KIDS", sortOrder: 4,
    tagline: "Structured, joyful training for young players.",
    description: "Structured training for younger players. Coordination games, racket skills and movement fundamentals taught through play — building confidence, discipline and a love for the sport.",
    ageGroup: "6–12 years", frequency: "3 or 5 sessions / week", sessionDuration: "60 min", programLength: "Term-based (12 weeks)",
    coachSlug: "meera-iyer", monthlyFee: rupees(1900),
    highlights: ["Max 10 kids per coach", "Coordination & agility games", "Parent progress updates", "Term-end mini tournament"],
  },
];

export const MEMBERSHIP_PLANS: (typeof membershipPlans.$inferInsert)[] = [
  {
    name: "Monthly", slug: "monthly", durationMonths: 1, price: rupees(2500), sortOrder: 1, courtDiscountPercent: 0,
    description: "Try the academy with full batch access, no long commitment.",
    trainingAccess: "1 batch · up to 3 sessions/week",
    benefits: ["Coaching in your assigned batch", "Monthly skill assessment", "Student dashboard & QR check-in", "Member rates on events"],
  },
  {
    name: "Quarterly", slug: "quarterly", durationMonths: 3, price: rupees(6900), sortOrder: 2, courtDiscountPercent: 5,
    description: "Our most popular plan for steady improvement.",
    trainingAccess: "1 batch · up to 4 sessions/week",
    benefits: ["Everything in Monthly", "5% off court bookings", "Free racket restring (1×)", "Priority batch transfers"],
    isFeatured: true,
  },
  {
    name: "Half-Yearly", slug: "half-yearly", durationMonths: 6, price: rupees(12900), sortOrder: 3, courtDiscountPercent: 10,
    description: "Serious training with room to switch batches.",
    trainingAccess: "Up to 2 batches · 5 sessions/week",
    benefits: ["Everything in Quarterly", "10% off court bookings", "Quarterly 1-on-1 coach review", "SmashPoint training tee"],
  },
  {
    name: "Annual", slug: "annual", durationMonths: 12, price: rupees(23900), sortOrder: 4, courtDiscountPercent: 15,
    description: "Best value for committed players and families.",
    trainingAccess: "Unlimited batches at your level",
    benefits: ["Everything in Half-Yearly", "15% off court bookings", "Free entry to 2 academy tournaments", "Video analysis session every quarter"],
  },
];
