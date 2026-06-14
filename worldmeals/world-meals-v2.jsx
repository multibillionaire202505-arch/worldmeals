import { useState, useEffect } from "react";

const MEALS = [
  { id:1, name:"Butter Chicken", country:"India", region:"Asia", emoji:"🍗", cal:580, budget:8, time:"50 min", spice:3, tags:["dairy","gluten-free-option"], desc:"Tender chicken in a velvety tomato-cream sauce infused with warming spices.", ingredients:["Chicken","Tomatoes","Butter","Heavy cream","Garam masala","Ginger","Garlic"], swaps:{ spice:[{from:"Chili powder",to:"Sweet paprika",note:"Same rich color, zero heat"}], dairy:[{from:"Heavy cream",to:"Coconut cream",note:"Adds subtle sweetness"},{from:"Butter",to:"Coconut oil",note:"Keeps richness without dairy"}], vegan:[{from:"Chicken",to:"Chickpeas + cauliflower",note:"Roast before adding to sauce"}]}},
  { id:2, name:"Sushi", country:"Japan", region:"Asia", emoji:"🍣", cal:320, budget:18, time:"30 min", spice:1, tags:["dairy-free","gluten-free-option"], desc:"Vinegared rice paired with fresh fish and vegetables. Clean, precise Japanese flavors.", ingredients:["Sushi rice","Salmon","Tuna","Nori","Soy sauce","Wasabi","Rice vinegar"], swaps:{spice:[{from:"Wasabi",to:"Cucumber slices",note:"Cool crunch, zero heat"}],gluten:[{from:"Soy sauce",to:"Tamari",note:"Identical flavor, fully GF"}],vegan:[{from:"Salmon/Tuna",to:"Mango + avocado",note:"Tropical fruit sushi — delicious"}]}},
  { id:3, name:"Pad Thai", country:"Thailand", region:"Asia", emoji:"🍜", cal:490, budget:9, time:"20 min", spice:2, tags:["dairy-free","gluten-free-option"], desc:"Stir-fried rice noodles with shrimp, tofu, egg in tangy tamarind sauce.", ingredients:["Rice noodles","Shrimp","Tofu","Eggs","Tamarind paste","Fish sauce","Peanuts"], swaps:{spice:[{from:"Chili flakes",to:"Skip or mild paprika",note:"Full tamarind flavor, no heat"}],vegan:[{from:"Shrimp",to:"Extra firm tofu",note:"Pan-fry until golden first"}]}},
  { id:4, name:"Pasta Carbonara", country:"Italy", region:"Europe", emoji:"🍝", cal:650, budget:8, time:"20 min", spice:1, tags:["dairy"], desc:"Creamy egg and pecorino sauce with guanciale and black pepper. No cream needed.", ingredients:["Spaghetti","Eggs","Pecorino romano","Guanciale","Black pepper"], swaps:{dairy:[{from:"Pecorino",to:"Nutritional yeast",note:"Cheesy umami without dairy"}],gluten:[{from:"Spaghetti",to:"Rice spaghetti",note:"Cook al dente — slightly less time"}],vegan:[{from:"Eggs",to:"Silken tofu blended",note:"Creates creamy coating"},{from:"Guanciale",to:"Smoked mushrooms",note:"Slice thin, pan-fry until crisp"}]}},
  { id:5, name:"Tacos al Pastor", country:"Mexico", region:"Americas", emoji:"🌮", cal:420, budget:5, time:"40 min", spice:3, tags:["dairy-free","gluten-free"], desc:"Marinated pork in corn tortillas with pineapple and cilantro. Street food perfection.", ingredients:["Pork shoulder","Corn tortillas","Pineapple","Achiote paste","Chili peppers","Cilantro"], swaps:{spice:[{from:"Chili peppers",to:"Mild ancho chili",note:"Smoky flavor, minimal heat"}],vegan:[{from:"Pork",to:"King oyster mushrooms",note:"Marinate same way, grill until charred"}]}},
  { id:6, name:"Bibimbap", country:"South Korea", region:"Asia", emoji:"🥗", cal:480, budget:9, time:"35 min", spice:2, tags:["dairy-free","vegan-option"], desc:"Rice bowl with seasoned vegetables, fried egg, and spicy gochujang. Mix before eating.", ingredients:["Steamed rice","Spinach","Carrots","Mushrooms","Fried egg","Gochujang","Sesame oil"], swaps:{spice:[{from:"Gochujang",to:"Miso + honey",note:"Umami sweetness, zero heat"}],vegan:[{from:"Fried egg",to:"Marinated tofu",note:"Season with soy and sesame"}]}},
  { id:7, name:"Falafel", country:"Lebanon", region:"Middle East", emoji:"🧆", cal:330, budget:5, time:"25 min", spice:1, tags:["dairy-free","vegan","gluten-free-option"], desc:"Crispy fried chickpea balls with cumin and coriander. Served in pita with tahini.", ingredients:["Chickpeas","Parsley","Cumin","Coriander","Garlic","Tahini","Lemon"], swaps:{gluten:[{from:"Pita bread",to:"Lettuce wraps",note:"Fresh and crunchy"}]}},
  { id:8, name:"Ceviche", country:"Peru", region:"Americas", emoji:"🦐", cal:220, budget:14, time:"25 min", spice:2, tags:["dairy-free","gluten-free"], desc:"Fresh fish cured in lime juice with red onion and chili. Light and refreshing.", ingredients:["White fish","Lime juice","Red onion","Ají amarillo","Cilantro","Corn"], swaps:{spice:[{from:"Ají amarillo",to:"Yellow bell pepper",note:"Same color, fruity flavor, no heat"}],vegan:[{from:"White fish",to:"Hearts of palm",note:"Absorbs lime cure beautifully"}]}},
  { id:9, name:"Moussaka", country:"Greece", region:"Europe", emoji:"🫕", cal:680, budget:11, time:"1.5 hrs", spice:1, tags:["dairy"], desc:"Layered eggplant and spiced lamb with creamy béchamel baked until golden.", ingredients:["Eggplant","Ground lamb","Tomatoes","Béchamel sauce","Cinnamon","Allspice"], swaps:{dairy:[{from:"Béchamel",to:"Oat milk béchamel",note:"Just as creamy"}],vegan:[{from:"Ground lamb",to:"Green lentils",note:"Season identically — deeply savory"}]}},
  { id:10, name:"Pho Bo", country:"Vietnam", region:"Asia", emoji:"🍲", cal:380, budget:7, time:"4 hrs", spice:1, tags:["dairy-free","gluten-free-option"], desc:"Clear beef bone broth over rice noodles with fresh herbs and lime.", ingredients:["Beef bones","Rice noodles","Star anise","Cinnamon","Ginger","Basil","Bean sprouts"], swaps:{vegan:[{from:"Beef bones",to:"Mushroom + ginger broth",note:"Roast shiitake for deep umami"},{from:"Fish sauce",to:"Soy sauce + nori",note:"Adds ocean depth"}]}},
  { id:11, name:"Jollof Rice", country:"Nigeria", region:"Africa", emoji:"🍚", cal:450, budget:5, time:"45 min", spice:2, tags:["dairy-free","gluten-free","vegan"], desc:"One-pot West African rice in tomato and pepper sauce. The centerpiece of any celebration.", ingredients:["Long grain rice","Tomatoes","Red bell pepper","Scotch bonnet","Onion","Chicken stock"], swaps:{spice:[{from:"Scotch bonnet",to:"Red bell pepper only",note:"All color and sweetness, no fire"}],vegan:[{from:"Chicken stock",to:"Vegetable stock",note:"Add smoked paprika for depth"}]}},
  { id:12, name:"Tagine", country:"Morocco", region:"Africa", emoji:"🍖", cal:610, budget:13, time:"2 hrs", spice:2, tags:["dairy-free","gluten-free"], desc:"Slow-cooked lamb with preserved lemon and olives in aromatic spices.", ingredients:["Lamb shoulder","Preserved lemon","Green olives","Cumin","Turmeric","Saffron","Honey"], swaps:{spice:[{from:"Cumin + ginger",to:"Turmeric + cinnamon",note:"Warm and fragrant, minimal heat"}],vegan:[{from:"Lamb",to:"Chickpeas + root vegetables",note:"Squash absorbs spice beautifully"}]}},
  { id:13, name:"Peking Duck", country:"China", region:"Asia", emoji:"🦆", cal:890, budget:35, time:"2 days", spice:1, tags:["dairy-free"], desc:"Imperial roast duck with crispy lacquered skin in thin pancakes with hoisin.", ingredients:["Whole duck","Maltose","Soy sauce","Five spice","Thin pancakes","Scallion","Hoisin sauce"], swaps:{gluten:[{from:"Thin pancakes",to:"Rice paper wrappers",note:"Soak 10 seconds — pliable and delicious"}],vegan:[{from:"Duck",to:"Whole roasted celeriac",note:"Glaze identically — skin crisps and caramelizes"}]}},
  { id:14, name:"Bratwurst", country:"Germany", region:"Europe", emoji:"🌭", cal:540, budget:6, time:"20 min", spice:1, tags:["dairy-free","gluten-free-option"], desc:"Juicy pork and veal sausage grilled with mustard and sauerkraut. A beer hall classic.", ingredients:["Pork + veal sausage","Bun","Mustard","Sauerkraut","Caraway seeds"], swaps:{gluten:[{from:"Crusty bun",to:"GF bun or lettuce wrap",note:"Toast the GF bun well"}],vegan:[{from:"Bratwurst",to:"Beyond sausage",note:"Grill on high heat for that char"}]}},
  { id:15, name:"Empanadas", country:"Argentina", region:"Americas", emoji:"🥟", cal:390, budget:5, time:"1 hr", spice:1, tags:["dairy-free-option"], desc:"Flaky pastry pockets stuffed with spiced ground beef, olives, and egg.", ingredients:["Flour dough","Ground beef","Green olives","Hard-boiled egg","Cumin","Paprika"], swaps:{gluten:[{from:"Wheat dough",to:"Cassava flour dough",note:"Roll slightly thicker — seals the same way"}],vegan:[{from:"Ground beef",to:"Black beans + corn",note:"Season same way — hearty and satisfying"}]}},
  { id:16, name:"Shawarma", country:"Lebanon", region:"Middle East", emoji:"🥙", cal:560, budget:8, time:"1 hr", spice:2, tags:["dairy-free-option","gluten-free-option"], desc:"Marinated meat on a rotating spit, wrapped in flatbread with garlic sauce.", ingredients:["Lamb or chicken","Flatbread","Garlic sauce","Turmeric","Cinnamon","Pickles"], swaps:{spice:[{from:"Cayenne",to:"Extra cumin + coriander",note:"Earthy and fragrant, no heat"}],dairy:[{from:"Garlic sauce",to:"Hummus or tahini",note:"Equally rich and dairy-free"}]}},
  { id:17, name:"Kimchi Jjigae", country:"South Korea", region:"Asia", emoji:"🥘", cal:350, budget:6, time:"30 min", spice:4, tags:["dairy-free","gluten-free-option"], desc:"Fiery kimchi stew with pork belly and silken tofu. Deeply savory Korean comfort food.", ingredients:["Kimchi","Pork belly","Silken tofu","Gochugaru","Garlic","Sesame oil"], swaps:{spice:[{from:"Gochugaru",to:"Mild kimchi, no extra chili",note:"All tang and umami, no fire"},{from:"Regular kimchi",to:"White kimchi",note:"Zero chili, full flavor"}],vegan:[{from:"Pork belly",to:"Mushrooms + firm tofu",note:"Use extra sesame oil for richness"}]}},
  { id:18, name:"Fish & Chips", country:"United Kingdom", region:"Europe", emoji:"🐟", cal:900, budget:10, time:"30 min", spice:1, tags:["dairy-free-option"], desc:"Beer-battered cod fried golden with thick-cut chips and mushy peas.", ingredients:["Cod fillet","Flour","Beer","Potatoes","Mushy peas","Malt vinegar"], swaps:{gluten:[{from:"Wheat flour + beer batter",to:"Rice flour + sparkling water",note:"Actually crispier — many chefs prefer it"}],vegan:[{from:"Cod",to:"Banana blossom",note:"Pull apart like fish, batter the same way"}]}},
  { id:19, name:"Gazpacho", country:"Spain", region:"Europe", emoji:"🍅", cal:160, budget:4, time:"15 min", spice:1, tags:["dairy-free","vegan","gluten-free"], desc:"Chilled blended raw tomato soup. Andalusia's answer to summer heat — zero cooking.", ingredients:["Ripe tomatoes","Cucumber","Red bell pepper","Garlic","Olive oil","Sherry vinegar"], swaps:{gluten:[{from:"Stale bread",to:"Omit or GF bread",note:"Blend an extra tomato for body"}]}},
  { id:20, name:"Injera & Doro Wat", country:"Ethiopia", region:"Africa", emoji:"🫓", cal:620, budget:10, time:"2 hrs", spice:3, tags:["dairy-free","vegan-option"], desc:"Tangy sourdough flatbread with slow-cooked spicy chicken stew. Eaten communally by hand.", ingredients:["Teff flour","Chicken legs","Berbere spice","Onion","Niter kibbeh","Hard-boiled eggs"], swaps:{spice:[{from:"Berbere blend",to:"Turmeric + coriander",note:"All earthiness, fraction of the heat"}],vegan:[{from:"Chicken",to:"Lentils (misir wat)",note:"Ethiopia's lentil stew — naturally vegan and iconic"}]}},
  { id:21, name:"Margherita Pizza", country:"Italy", region:"Europe", emoji:"🍕", cal:700, budget:7, time:"25 min", spice:1, tags:["vegan-option"], desc:"Thin Neapolitan crust with San Marzano tomatoes, buffalo mozzarella, and fresh basil.", ingredients:["00 flour","San Marzano tomatoes","Buffalo mozzarella","Fresh basil","Olive oil"], swaps:{dairy:[{from:"Buffalo mozzarella",to:"Cashew mozzarella",note:"Soak cashews overnight — melts beautifully"}],gluten:[{from:"00 flour dough",to:"Cauliflower crust",note:"Press very dry before baking for crispiness"}]}},
  { id:22, name:"Croissant", country:"France", region:"Europe", emoji:"🥐", cal:310, budget:4, time:"3 hrs", spice:1, tags:["vegan-option"], desc:"Buttery, flaky pastry with hundreds of paper-thin layers. Best eaten warm.", ingredients:["Bread flour","European butter","Milk","Yeast","Sugar","Eggs"], swaps:{dairy:[{from:"European butter",to:"Vegan block butter 80%+ fat",note:"Flora Plant or Naturli work best"},{from:"Milk",to:"Full-fat oat milk",note:"Best for lamination"}]}},
  { id:23, name:"Boeuf Bourguignon", country:"France", region:"Europe", emoji:"🥩", cal:720, budget:20, time:"3 hrs", spice:1, tags:["dairy","gluten-free-option"], desc:"Slow-braised beef in Burgundy wine with pearl onions, mushrooms, and lardons.", ingredients:["Beef chuck","Red Burgundy wine","Pearl onions","Mushrooms","Lardons","Carrots","Thyme"], swaps:{gluten:[{from:"Flour (thickening)",to:"Cornstarch slurry at end",note:"1 tbsp cornstarch in cold water, last 10 min"}],vegan:[{from:"Beef",to:"Portobello mushrooms + lentils",note:"Same wine and technique — deeply satisfying"}]}},
  { id:24, name:"Ramen", country:"Japan", region:"Asia", emoji:"🍜", cal:550, budget:12, time:"45 min", spice:1, tags:["dairy-free"], desc:"Rich miso broth loaded with pork belly, soft-boiled egg, and bamboo shoots.", ingredients:["Ramen noodles","Pork belly","Miso paste","Soy sauce","Soft-boiled egg","Nori","Bamboo shoots"], swaps:{gluten:[{from:"Ramen noodles",to:"Rice ramen noodles",note:"Available in Asian grocery stores — similar chew"}],vegan:[{from:"Pork belly",to:"Braised king oyster mushrooms",note:"Braise in soy + mirin until tender"},{from:"Soft-boiled egg",to:"Marinated tofu cubes",note:"Soy + mirin overnight — incredible flavor"}]}},
];

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const REGIONS = ["All regions","Asia","Europe","Americas","Africa","Middle East"];
const SPICE_LABELS = ["","Mild 🟢","Low 🟡","Medium 🟠","Hot 🔴","Fiery 🌶️"];
const DIETS = ["All diets","dairy-free","gluten-free","vegan","gluten-free-option","vegan-option"];
const DIET_LABELS = {"All diets":"All diets","dairy-free":"Dairy-free","gluten-free":"Gluten-free","vegan":"Vegan","gluten-free-option":"GF option","vegan-option":"Vegan option"};
const ALL_COUNTRIES = [...new Set(MEALS.map(m => m.country))];
const TOUR_TOTAL = ALL_COUNTRIES.length;

const spiceColor = s => ["","#22C55E","#EAB308","#F97316","#EF4444","#9B1C1C"][s] || "#ccc";

export default function WorldMeals() {
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All regions");
  const [maxCal, setMaxCal] = useState(1000);
  const [maxBudget, setMaxBudget] = useState(40);
  const [maxSpice, setMaxSpice] = useState(5);
  const [diet, setDiet] = useState("All diets");
  const [selected, setSelected] = useState(null);
  const [activeSwap, setActiveSwap] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wm_favorites") || "[]"); } catch { return []; }
  });
  const [cooked, setCooked] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wm_cooked") || "[]"); } catch { return []; }
  });
  const [weekPlan, setWeekPlan] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wm_week") || "{}"); } catch { return {}; }
  });
  const [mapCountry, setMapCountry] = useState(null);
  const [toast, setToast] = useState(null);
  const [planPicker, setPlanPicker] = useState(null);
  const [fridgeInput, setFridgeInput] = useState("");
  const [fridgeResult, setFridgeResult] = useState(null);
  const [fridgeLoading, setFridgeLoading] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("wm_favorites", JSON.stringify(favorites)); } catch {}
  }, [favorites]);
  useEffect(() => {
    try { localStorage.setItem("wm_cooked", JSON.stringify(cooked)); } catch {}
  }, [cooked]);
  useEffect(() => {
    try { localStorage.setItem("wm_week", JSON.stringify(weekPlan)); } catch {}
  }, [weekPlan]);

  const showToast = (msg, emoji="✅") => {
    setToast({ msg, emoji });
    setTimeout(() => setToast(null), 2200);
  };

  const toggleFav = (id) => {
    setFavorites(f => f.includes(id) ? f.filter(x=>x!==id) : [...f, id]);
    const meal = MEALS.find(m=>m.id===id);
    const isFav = favorites.includes(id);
    showToast(isFav ? `Removed from favourites` : `${meal.name} saved!`, isFav ? "💔" : "❤️");
  };

  const markCooked = (id) => {
    if (!cooked.includes(id)) {
      setCooked(c => [...c, id]);
      const meal = MEALS.find(m=>m.id===id);
      showToast(`${meal.name} cooked! 🏆 ${cooked.length+1}/${TOUR_TOTAL} countries`, "🍽️");
    }
  };

  const assignToDay = (day, mealId) => {
    setWeekPlan(p => ({ ...p, [day]: mealId }));
    setPlanPicker(null);
    const meal = MEALS.find(m=>m.id===mealId);
    showToast(`${meal.name} added to ${day}`, "📅");
  };

  const clearDay = (day) => {
    setWeekPlan(p => { const n={...p}; delete n[day]; return n; });
  };

  const weekCalTotal = Object.values(weekPlan).reduce((sum,id) => {
    const m = MEALS.find(x=>x.id===id);
    return sum + (m?.cal||0);
  }, 0);
  const weekBudgetTotal = Object.values(weekPlan).reduce((sum,id) => {
    const m = MEALS.find(x=>x.id===id);
    return sum + (m?.budget||0);
  }, 0);

  const cookedCountries = [...new Set(cooked.map(id => MEALS.find(m=>m.id===id)?.country).filter(Boolean))];
  const tourPct = Math.round((cookedCountries.length / TOUR_TOTAL) * 100);

  const filtered = MEALS.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.country.toLowerCase().includes(q);
    const matchRegion = region === "All regions" || m.region === region;
    const matchCal = m.cal <= maxCal;
    const matchBudget = m.budget <= maxBudget;
    const matchSpice = m.spice <= maxSpice;
    const matchDiet = diet === "All diets" || m.tags.includes(diet);
    return matchSearch && matchRegion && matchCal && matchBudget && matchSpice && matchDiet;
  });

  async function runFridgeChef() {
    if (!fridgeInput.trim()) return;
    setFridgeLoading(true);
    setFridgeResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:1000,
          messages:[{role:"user",content:`You are a world cuisine chef. Ingredients available: ${fridgeInput}. Suggest ONE authentic world dish. Respond ONLY with valid JSON no markdown:\n{"name":"","country":"","emoji":"","calories":0,"cookTime":"","spiceLevel":1,"description":"","missingIngredients":[],"steps":[],"tip":""}`}]
        })
      });
      const data = await res.json();
      const text = data.content.find(b=>b.type==="text")?.text||"";
      setFridgeResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setFridgeResult({error:true}); }
    setFridgeLoading(false);
  }

  const favMeals = MEALS.filter(m => favorites.includes(m.id));

  const NAV = [["browse","🍽","Browse"],["planner","📅","Planner"],["map","🗺","Map"],["tour","🏆","Tour"],["chef","🍳","Chef"],["saved","❤️","Saved"]];

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#FAFAF8",minHeight:"100vh",color:"#1a1a18",paddingBottom:70}}>

      {/* HEADER */}
      <div style={{background:"#1a1a18",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:40}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22}}>🌍</span>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#fff",letterSpacing:"-0.3px"}}>World Meals</div>
            <div style={{fontSize:10,color:"#666"}}>Every dish. Every country.</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {favorites.length > 0 && <div style={{background:"#EF4444",color:"#fff",borderRadius:20,fontSize:11,padding:"2px 8px",fontWeight:600}}>❤️ {favorites.length}</div>}
          <div style={{background:"#2a2a28",color:"#aaa",borderRadius:20,fontSize:11,padding:"2px 8px"}}>{tourPct}% 🌍</div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",background:"#1a1a18",color:"#fff",padding:"10px 18px",borderRadius:30,fontSize:13,fontWeight:500,zIndex:100,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",whiteSpace:"nowrap"}}>
          {toast.emoji} {toast.msg}
        </div>
      )}

      {/* BROWSE TAB */}
      {tab==="browse" && (
        <div style={{padding:"14px 14px 0"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search dish or country…"
            style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #E5E5E0",fontSize:14,background:"#fff",marginBottom:10,outline:"none",boxSizing:"border-box"}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:10,color:"#888",marginBottom:3}}>Region</div>
              <select value={region} onChange={e=>setRegion(e.target.value)} style={{width:"100%",padding:"7px 8px",borderRadius:8,border:"1px solid #E5E5E0",fontSize:12,background:"#fff"}}>
                {REGIONS.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10,color:"#888",marginBottom:3}}>Diet</div>
              <select value={diet} onChange={e=>setDiet(e.target.value)} style={{width:"100%",padding:"7px 8px",borderRadius:8,border:"1px solid #E5E5E0",fontSize:12,background:"#fff"}}>
                {DIETS.map(d=><option key={d} value={d}>{DIET_LABELS[d]}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[["Max cal",maxCal,200,1000,50,setMaxCal,v=>v+" kcal"],["Budget",maxBudget,1,40,1,setMaxBudget,v=>"$"+v],["Spice",maxSpice,1,5,1,setMaxSpice,v=>SPICE_LABELS[v]]].map(([label,val,min,max,step,set,fmt])=>(
              <div key={label}>
                <div style={{fontSize:10,color:"#888",marginBottom:3}}>{label}: <b style={{color:"#1a1a18"}}>{fmt(val)}</b></div>
                <input type="range" min={min} max={max} step={step} value={val} onChange={e=>set(+e.target.value)} style={{width:"100%"}}/>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:"#888",marginBottom:10}}>{filtered.length} dishes</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
            {filtered.map(m=>(
              <div key={m.id} style={{background:"#fff",borderRadius:14,border:"1px solid #EBEBEB",overflow:"hidden",cursor:"pointer",position:"relative"}}
                onClick={()=>{setSelected(m);setActiveSwap(null);}}>
                <div style={{background:"#F5F5F0",fontSize:42,display:"flex",alignItems:"center",justifyContent:"center",height:76}}>{m.emoji}</div>
                <button onClick={e=>{e.stopPropagation();toggleFav(m.id);}}
                  style={{position:"absolute",top:6,right:6,background:"rgba(255,255,255,0.9)",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {favorites.includes(m.id)?"❤️":"🤍"}
                </button>
                {cooked.includes(m.id) && <div style={{position:"absolute",top:6,left:6,background:"#1a1a18",color:"#fff",borderRadius:20,fontSize:10,padding:"2px 6px"}}>✓ Cooked</div>}
                <div style={{padding:"8px 10px"}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{m.name}</div>
                  <div style={{fontSize:10,color:"#888",marginBottom:6}}>📍 {m.country}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                    <span style={{fontSize:10,background:"#FEF3C7",color:"#92400E",borderRadius:8,padding:"1px 6px"}}>{m.cal} kcal</span>
                    <span style={{fontSize:10,background:"#DCFCE7",color:"#166534",borderRadius:8,padding:"1px 6px"}}>${m.budget}</span>
                    <span style={{fontSize:10,background:"#F5F5F0",color:"#555",borderRadius:8,padding:"1px 6px",display:"flex",alignItems:"center",gap:2}}>
                      <span style={{width:5,height:5,borderRadius:"50%",background:spiceColor(m.spice),display:"inline-block"}}/>
                      {SPICE_LABELS[m.spice]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filtered.length===0 && <div style={{textAlign:"center",padding:"3rem 0",color:"#aaa"}}>No dishes match. Try relaxing your filters.</div>}
        </div>
      )}

      {/* PLANNER TAB */}
      {tab==="planner" && (
        <div style={{padding:"14px"}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>📅 Weekly Meal Planner</div>
          <div style={{fontSize:12,color:"#888",marginBottom:14}}>Plan your world food journey for the week</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            <div style={{background:"#FEF3C7",borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:700,color:"#92400E"}}>{weekCalTotal.toLocaleString()}</div>
              <div style={{fontSize:11,color:"#92400E"}}>total kcal this week</div>
            </div>
            <div style={{background:"#DCFCE7",borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:700,color:"#166534"}}>${weekBudgetTotal}</div>
              <div style={{fontSize:11,color:"#166534"}}>total budget this week</div>
            </div>
          </div>
          {DAYS.map(day => {
            const mealId = weekPlan[day];
            const meal = mealId ? MEALS.find(m=>m.id===mealId) : null;
            return (
              <div key={day} style={{background:"#fff",borderRadius:14,border:"1px solid #EBEBEB",padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontWeight:700,fontSize:13,minWidth:32,color:"#888"}}>{day}</div>
                {meal ? (
                  <>
                    <span style={{fontSize:22}}>{meal.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{meal.name}</div>
                      <div style={{fontSize:11,color:"#888"}}>📍 {meal.country} · {meal.cal} kcal · ${meal.budget}</div>
                    </div>
                    <button onClick={()=>clearDay(day)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:16}}>✕</button>
                  </>
                ) : (
                  <>
                    <div style={{flex:1,fontSize:12,color:"#ccc"}}>No meal planned</div>
                    <button onClick={()=>setPlanPicker(day)}
                      style={{fontSize:12,padding:"6px 12px",borderRadius:20,border:"1px solid #E5E5E0",background:"#fff",cursor:"pointer",color:"#555"}}>
                      + Add dish
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {planPicker && (
            <div onClick={e=>e.target===e.currentTarget&&setPlanPicker(null)}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:60,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
              <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"70vh",overflowY:"auto",padding:"16px"}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Choose a dish for {planPicker}</div>
                {MEALS.map(m=>(
                  <div key={m.id} onClick={()=>assignToDay(planPicker,m.id)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px",borderRadius:10,cursor:"pointer",marginBottom:4,background:"#F9F9F7"}}>
                    <span style={{fontSize:24}}>{m.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{m.name}</div>
                      <div style={{fontSize:11,color:"#888"}}>📍 {m.country} · {m.cal} kcal · ${m.budget}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAP TAB */}
      {tab==="map" && (
        <div style={{padding:"14px"}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>🗺 World Map</div>
          <div style={{fontSize:12,color:"#888",marginBottom:14}}>Tap a country to explore its cuisine</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:18}}>
            {ALL_COUNTRIES.map(c=>{
              const dishes=MEALS.filter(m=>m.country===c);
              const isCooked=dishes.every(m=>cooked.includes(m.id));
              return (
                <button key={c} onClick={()=>setMapCountry(mapCountry===c?null:c)}
                  style={{padding:"7px 12px",borderRadius:20,border:mapCountry===c?"2px solid #1a1a18":"1px solid #E5E5E0",background:mapCountry===c?"#1a1a18":isCooked?"#F0FDF4":"#fff",color:mapCountry===c?"#fff":isCooked?"#166534":"#1a1a18",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  <span>{dishes[0]?.emoji}</span>{c}{isCooked&&<span>✓</span>}<span style={{fontSize:10,opacity:0.5}}>({dishes.length})</span>
                </button>
              );
            })}
          </div>
          {mapCountry && (
            <div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Dishes from {mapCountry}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
                {MEALS.filter(m=>m.country===mapCountry).map(m=>(
                  <div key={m.id} onClick={()=>{setSelected(m);setActiveSwap(null);setTab("browse");}}
                    style={{background:"#fff",borderRadius:14,border:"1px solid #EBEBEB",overflow:"hidden",cursor:"pointer",position:"relative"}}>
                    <div style={{background:"#F5F5F0",fontSize:42,display:"flex",alignItems:"center",justifyContent:"center",height:76}}>{m.emoji}</div>
                    {cooked.includes(m.id)&&<div style={{position:"absolute",top:6,left:6,background:"#1a1a18",color:"#fff",borderRadius:20,fontSize:10,padding:"2px 6px"}}>✓ Cooked</div>}
                    <div style={{padding:"8px 10px"}}>
                      <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>{m.name}</div>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,background:"#FEF3C7",color:"#92400E",borderRadius:8,padding:"1px 6px"}}>{m.cal} kcal</span>
                        <span style={{fontSize:10,background:"#DCFCE7",color:"#166534",borderRadius:8,padding:"1px 6px"}}>${m.budget}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WORLD TOUR TAB */}
      {tab==="tour" && (
        <div style={{padding:"14px"}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>🏆 World Tour Challenge</div>
          <div style={{fontSize:12,color:"#888",marginBottom:14}}>Cook a dish from every country. Earn your place on the global map.</div>
          <div style={{background:"#1a1a18",borderRadius:16,padding:"16px",marginBottom:16,color:"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
              <div>
                <div style={{fontSize:28,fontWeight:700}}>{cookedCountries.length}<span style={{fontSize:14,fontWeight:400,color:"#888"}}>/{TOUR_TOTAL}</span></div>
                <div style={{fontSize:12,color:"#888"}}>countries conquered</div>
              </div>
              <div style={{fontSize:32,fontWeight:700,color:tourPct>=100?"#FFD700":tourPct>=50?"#22C55E":"#888"}}>{tourPct}%</div>
            </div>
            <div style={{height:6,background:"#333",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:tourPct+"%",background:tourPct>=100?"#FFD700":tourPct>=50?"#22C55E":"#3B82F6",borderRadius:3,transition:"width 0.4s ease"}}/>
            </div>
            <div style={{fontSize:11,color:"#666",marginTop:8}}>
              {tourPct===0 && "Cook your first dish to start your world tour! 🌍"}
              {tourPct>0 && tourPct<25 && "You're exploring! Keep discovering new cuisines 🗺"}
              {tourPct>=25 && tourPct<50 && "Quarter of the world done — you're a true food explorer! 🍽"}
              {tourPct>=50 && tourPct<100 && "Over halfway! The culinary world is yours 🌟"}
              {tourPct>=100 && "🎉 WORLD TOUR COMPLETE! You are a global chef legend!"}
            </div>
          </div>
          <div style={{fontSize:12,fontWeight:600,color:"#888",letterSpacing:"0.05em",marginBottom:10}}>ALL COUNTRIES</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {ALL_COUNTRIES.map(country => {
              const dishes = MEALS.filter(m=>m.country===country);
              const cookedHere = dishes.filter(m=>cooked.includes(m.id)).length;
              const done = cookedHere > 0;
              return (
                <div key={country} style={{background:"#fff",borderRadius:12,border:`1px solid ${done?"#BBF7D0":"#EBEBEB"}`,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:24}}>{dishes[0]?.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:done?"#166534":"#1a1a18"}}>{country}</div>
                    <div style={{fontSize:11,color:"#888"}}>{dishes.length} dish{dishes.length>1?"es":""} · {cookedHere} cooked</div>
                  </div>
                  {done
                    ? <div style={{background:"#DCFCE7",color:"#166534",borderRadius:20,fontSize:11,padding:"3px 10px",fontWeight:600}}>✓ Done</div>
                    : <button onClick={()=>{setMapCountry(country);setTab("map");}}
                        style={{background:"#F5F5F0",color:"#555",border:"none",borderRadius:20,fontSize:11,padding:"3px 10px",cursor:"pointer"}}>Explore →</button>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CHEF TAB */}
      {tab==="chef" && (
        <div style={{padding:"14px"}}>
          <div style={{background:"#1a1a18",borderRadius:16,padding:"18px",marginBottom:16,color:"#fff"}}>
            <div style={{fontSize:22,marginBottom:6}}>🍳</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:3}}>AI Fridge Chef</div>
            <div style={{fontSize:12,color:"#aaa",lineHeight:1.5}}>Tell me what's in your fridge and I'll find you an authentic world dish to cook right now.</div>
          </div>
          <textarea value={fridgeInput} onChange={e=>setFridgeInput(e.target.value)}
            placeholder="e.g. chicken, coconut milk, lemongrass, rice, garlic, lime…"
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid #E5E5E0",fontSize:14,minHeight:90,resize:"none",background:"#fff",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
          <button onClick={runFridgeChef} disabled={fridgeLoading||!fridgeInput.trim()}
            style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:fridgeLoading||!fridgeInput.trim()?"#ccc":"#1a1a18",color:"#fff",fontSize:14,fontWeight:600,cursor:fridgeLoading||!fridgeInput.trim()?"not-allowed":"pointer",marginBottom:16}}>
            {fridgeLoading?"Searching the world's kitchens…":"✨ Find me a world dish"}
          </button>
          {fridgeResult && !fridgeResult.error && (
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #EBEBEB",overflow:"hidden"}}>
              <div style={{background:"#F5F5F0",fontSize:56,display:"flex",alignItems:"center",justifyContent:"center",height:100}}>{fridgeResult.emoji}</div>
              <div style={{padding:"14px"}}>
                <div style={{fontSize:20,fontWeight:700,marginBottom:2}}>{fridgeResult.name}</div>
                <div style={{fontSize:12,color:"#888",marginBottom:10}}>📍 {fridgeResult.country} · ⏱ {fridgeResult.cookTime} · 🔥 {fridgeResult.calories} kcal</div>
                <div style={{fontSize:13,color:"#555",lineHeight:1.6,marginBottom:12}}>{fridgeResult.description}</div>
                {fridgeResult.missingIngredients?.length>0 && (
                  <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:600,color:"#92400E",marginBottom:3}}>YOU'LL ALSO NEED</div>
                    <div style={{fontSize:12,color:"#92400E"}}>{fridgeResult.missingIngredients.join(", ")}</div>
                  </div>
                )}
                <div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:"0.05em",marginBottom:8}}>STEPS</div>
                {fridgeResult.steps?.map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#1a1a18",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                    <div style={{fontSize:12,color:"#444",lineHeight:1.5,paddingTop:2}}>{s}</div>
                  </div>
                ))}
                {fridgeResult.tip && (
                  <div style={{background:"#F0FDF4",borderRadius:10,padding:"10px 12px",marginTop:8}}>
                    <div style={{fontSize:10,fontWeight:600,color:"#166534",marginBottom:2}}>💡 CHEF'S TIP</div>
                    <div style={{fontSize:12,color:"#166534"}}>{fridgeResult.tip}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {fridgeResult?.error && <div style={{padding:"12px",background:"#FEE2E2",borderRadius:10,color:"#991B1B",fontSize:13}}>Couldn't find a dish right now — try again!</div>}
        </div>
      )}

      {/* SAVED TAB */}
      {tab==="saved" && (
        <div style={{padding:"14px"}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>❤️ Saved Dishes</div>
          <div style={{fontSize:12,color:"#888",marginBottom:14}}>Your personal world cookbook</div>
          {favMeals.length===0 ? (
            <div style={{textAlign:"center",padding:"3rem 1rem",color:"#aaa"}}>
              <div style={{fontSize:40,marginBottom:12}}>🤍</div>
              <div style={{fontSize:14,marginBottom:6}}>No saved dishes yet</div>
              <div style={{fontSize:12}}>Tap the heart on any dish to save it here</div>
              <button onClick={()=>setTab("browse")} style={{marginTop:16,padding:"10px 20px",borderRadius:20,background:"#1a1a18",color:"#fff",border:"none",fontSize:13,cursor:"pointer"}}>Browse dishes →</button>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
              {favMeals.map(m=>(
                <div key={m.id} style={{background:"#fff",borderRadius:14,border:"1px solid #EBEBEB",overflow:"hidden",cursor:"pointer",position:"relative"}}
                  onClick={()=>{setSelected(m);setActiveSwap(null);}}>
                  <div style={{background:"#F5F5F0",fontSize:42,display:"flex",alignItems:"center",justifyContent:"center",height:76}}>{m.emoji}</div>
                  <button onClick={e=>{e.stopPropagation();toggleFav(m.id);}}
                    style={{position:"absolute",top:6,right:6,background:"rgba(255,255,255,0.9)",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",fontSize:14}}>❤️</button>
                  <div style={{padding:"8px 10px"}}>
                    <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{m.name}</div>
                    <div style={{fontSize:10,color:"#888",marginBottom:6}}>📍 {m.country}</div>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,background:"#FEF3C7",color:"#92400E",borderRadius:8,padding:"1px 6px"}}>{m.cal} kcal</span>
                      <span style={{fontSize:10,background:"#DCFCE7",color:"#166534",borderRadius:8,padding:"1px 6px"}}>${m.budget}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISH DETAIL MODAL */}
      {selected && (
        <div onClick={e=>e.target===e.currentTarget&&setSelected(null)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{background:"#F5F5F0",fontSize:60,display:"flex",alignItems:"center",justifyContent:"center",height:110,position:"relative"}}>
              {selected.emoji}
              <button onClick={()=>setSelected(null)} style={{position:"absolute",top:12,right:12,background:"rgba(0,0,0,0.1)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14,color:"#555"}}>✕</button>
              <button onClick={()=>toggleFav(selected.id)} style={{position:"absolute",top:12,left:12,background:"rgba(255,255,255,0.9)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:16}}>
                {favorites.includes(selected.id)?"❤️":"🤍"}
              </button>
            </div>
            <div style={{padding:"14px 16px 32px"}}>
              <div style={{fontSize:21,fontWeight:700,marginBottom:2}}>{selected.name}</div>
              <div style={{fontSize:12,color:"#888",marginBottom:10}}>📍 {selected.country} · {selected.region}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                {[["🔥",selected.cal,"kcal"],["💰","$"+selected.budget,"per serving"],["⏱",selected.time,"cook time"]].map(([ic,v,l])=>(
                  <div key={l} style={{background:"#F5F5F0",borderRadius:10,padding:"8px",textAlign:"center"}}>
                    <div style={{fontSize:12}}>{ic}</div>
                    <div style={{fontSize:14,fontWeight:600}}>{v}</div>
                    <div style={{fontSize:10,color:"#888"}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,background:"#F9F9F7",borderRadius:10,padding:"8px 12px"}}>
                <div style={{fontSize:11,color:"#888"}}>Spice:</div>
                <div style={{display:"flex",gap:3}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<=selected.spice?spiceColor(selected.spice):"#E5E5E0"}}/>)}</div>
                <div style={{fontSize:12,fontWeight:500}}>{SPICE_LABELS[selected.spice]}</div>
              </div>
              <div style={{fontSize:13,color:"#555",lineHeight:1.6,marginBottom:14}}>{selected.desc}</div>
              <div style={{fontSize:10,fontWeight:600,color:"#888",letterSpacing:"0.05em",marginBottom:8}}>INGREDIENTS</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
                {selected.ingredients.map(i=><span key={i} style={{fontSize:11,background:"#F5F5F0",borderRadius:20,padding:"3px 9px"}}>{i}</span>)}
              </div>
              {selected.swaps && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,fontWeight:600,color:"#888",letterSpacing:"0.05em",marginBottom:8}}>🔄 SMART SUBSTITUTIONS</div>
                  <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
                    {Object.keys(selected.swaps).map(key=>{
                      const labels={spice:"🌶 Reduce spice",dairy:"🥛 Dairy-free",vegan:"🌱 Make vegan",gluten:"🌾 Gluten-free"};
                      const colors={spice:["#FEF3C7","#92400E"],dairy:["#EFF6FF","#1E40AF"],vegan:["#F0FDF4","#166534"],gluten:["#FDF4FF","#7E22CE"]};
                      const [bg,fg]=colors[key]||["#F5F5F0","#555"];
                      return (
                        <button key={key} onClick={()=>setActiveSwap(activeSwap===key?null:key)}
                          style={{fontSize:11,padding:"5px 11px",borderRadius:20,border:activeSwap===key?"2px solid "+fg:"1px solid #E5E5E0",background:activeSwap===key?bg:"#fff",color:activeSwap===key?fg:"#555",cursor:"pointer",fontWeight:activeSwap===key?600:400}}>
                          {labels[key]||key}
                        </button>
                      );
                    })}
                  </div>
                  {activeSwap && selected.swaps[activeSwap] && (
                    <div style={{background:"#F9F9F7",borderRadius:12,padding:"12px"}}>
                      {selected.swaps[activeSwap].map((s,i)=>(
                        <div key={i} style={{marginBottom:i<selected.swaps[activeSwap].length-1?10:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                            <span style={{fontSize:11,background:"#FFE4E4",borderRadius:6,padding:"2px 7px",color:"#991B1B",textDecoration:"line-through"}}>{s.from}</span>
                            <span style={{fontSize:12}}>→</span>
                            <span style={{fontSize:11,background:"#DCFCE7",borderRadius:6,padding:"2px 7px",color:"#166534",fontWeight:500}}>{s.to}</span>
                          </div>
                          <div style={{fontSize:11,color:"#666",paddingLeft:2}}>💡 {s.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button onClick={()=>{markCooked(selected.id);}}
                  style={{padding:"11px",borderRadius:12,border:"none",background:cooked.includes(selected.id)?"#DCFCE7":"#1a1a18",color:cooked.includes(selected.id)?"#166534":"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {cooked.includes(selected.id)?"✓ Cooked!":"Mark as cooked 🍽"}
                </button>
                <button onClick={()=>{setPlanPicker(true);setSelected(null);setTab("planner");}}
                  style={{padding:"11px",borderRadius:12,border:"1px solid #E5E5E0",background:"#fff",color:"#1a1a18",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  📅 Add to plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #EBEBEB",display:"flex",zIndex:40}}>
        {NAV.map(([t,ic,label])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{flex:1,padding:"10px 0 8px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:18}}>{ic}</span>
            <span style={{fontSize:9,color:tab===t?"#1a1a18":"#aaa",fontWeight:tab===t?600:400}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
