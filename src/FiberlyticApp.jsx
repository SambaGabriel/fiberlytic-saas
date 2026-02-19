import React, { useState, useCallback, useMemo, useRef, createContext, useContext, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ─── Theme ───────────────────────────────────────────────────────────────────
const DARK = {
 bg:"#111111",bgCard:"#191919",bgCardHover:"#222222",bgSidebar:"#111111",
 bgInput:"#222222",border:"#2A2A2A",borderFocus:"#555555",
 text:"#F0F0F0",textMuted:"#888888",textDim:"#555555",
 accent:"#F0F0F0",accentHover:"#CCCCCC",accentSoft:"rgba(255,255,255,0.06)",
 success:"#4ADE80",successSoft:"rgba(74,222,128,0.08)",
 warning:"#FACC15",warningSoft:"rgba(250,204,21,0.08)",
 danger:"#F87171",dangerSoft:"rgba(248,113,113,0.06)",
 purple:"#C084FC",purpleSoft:"rgba(192,132,252,0.08)",
 cyan:"#888888",cyanSoft:"rgba(136,136,136,0.08)",
 orange:"#D4A520",orangeSoft:"rgba(212,165,32,0.10)",
 money:"#4ADE80",moneySoft:"rgba(74,222,128,0.06)",
 chatMe:"#222222",chatThem:"#191919",
};
const LIGHT = {
 bg:"#FAFAFA",bgCard:"#FFFFFF",bgCardHover:"#F5F5F5",bgSidebar:"#FFFFFF",
 bgInput:"#F5F5F5",border:"#E5E5E5",borderFocus:"#111111",
 text:"#111111",textMuted:"#6B6B6B",textDim:"#999999",
 accent:"#111111",accentHover:"#333333",accentSoft:"rgba(0,0,0,0.04)",
 success:"#16A34A",successSoft:"rgba(22,163,74,0.05)",
 warning:"#A16207",warningSoft:"rgba(161,98,7,0.05)",
 danger:"#DC2626",dangerSoft:"rgba(220,38,38,0.05)",
 purple:"#7C3AED",purpleSoft:"rgba(124,58,237,0.05)",
 cyan:"#6B6B6B",cyanSoft:"rgba(107,107,107,0.06)",
 orange:"#B8860B",orangeSoft:"rgba(184,134,11,0.06)",
 money:"#16A34A",moneySoft:"rgba(22,163,74,0.05)",
 chatMe:"#F0F0F0",chatThem:"#F5F5F5",
};
// Sidebar always dark regardless of theme
const SIDEBAR_THEME = {
 bg:"#111111",text:"#999999",textDim:"#555555",accent:"#FFFFFF",
 accentSoft:"rgba(255,255,255,0.08)",border:"#2A2A2A",input:"#1A1A1A",
};
let T = LIGHT;

const CLIENTS=["MasTec"];
const CUSTOMERS=["Brightspeed","Spectrum","All Points Broadband"];
const REGIONS=["Alabama","North Carolina","Virginia","Tennessee"];
const LOCATIONS={Alabama:["Falkville, AL","Decatur, AL","Huntsville, AL"],"North Carolina":["Morganton, NC","Hickory, NC"],Virginia:["Roanoke, VA","Salem, VA"],Tennessee:["Knoxville, TN","Chattanooga, TN"]};
const OLTS=["FLVLALXA","DCTURALX","HSVLALXA","MRGTNNCX","RNKVAVAX"];
const WORK_TYPES=["Strand","Overlash","Fiber","Fiber Conduit Pulling","Anchor","Coil","Entry","DB-Normal","DB-Cobble","DB-Rock","DB-Additional","DB-Additional-Rock"];

// ─── Document Types for Job Document Vault ──────────────────────────────────
const DOC_TYPES=[
 {key:"permit",label:"Permit",icon:"P",desc:"City/county/DOT construction permits, ROW permits"},
 {key:"easement",label:"Easement",icon:"E",desc:"Private property access agreements"},
 {key:"make_ready",label:"Make-Ready",icon:"M",desc:"Engineering packets, pole loading analysis"},
 {key:"as_built",label:"As-Built",icon:"A",desc:"Final construction drawings"},
 {key:"completion",label:"Completion Form",icon:"C",desc:"Signed close-out documents"},
 {key:"safety",label:"Safety / JHA",icon:"S",desc:"Job Hazard Analysis, tailboard forms, safety plans"},
 {key:"photo",label:"Photo Evidence",icon:"◉",desc:"Construction photos, before/after, damage"},
 {key:"other",label:"Other",icon:"…",desc:"Miscellaneous documents"},
];
const DOC_STATUS_CFG={
 current:{c:"#4ADE80",bg:"rgba(74,222,128,0.08)",label:"Current"},
 pending:{c:"#FACC15",bg:"rgba(250,204,21,0.08)",label:"Pending Review"},
 expired:{c:"#F87171",bg:"rgba(248,113,113,0.06)",label:"Expired"},
 archived:{c:"#888888",bg:"rgba(136,136,136,0.08)",label:"Archived"},
};
function seedDocs(jobId,st,compDate,feederId,dept){
 const docs=[];const DAY=86400000;const base=new Date(compDate).getTime();
 const hasProd=["Pending Redlines","Under Client Review","Ready to Invoice","Rejected","Billed"].includes(st);
 const isComplete=["Ready to Invoice","Billed"].includes(st);
 const num=parseInt(jobId)||1;
 // Permit — most jobs have one
 if(num%3!==2){
  const permitDate=new Date(base-14*DAY);const expires=new Date(base+180*DAY);
  docs.push({id:`doc-${jobId}-p1`,type:"permit",name:dept==="underground"?`Bore_Permit_${feederId}.pdf`:`ROW_Permit_${feederId}.pdf`,status:expires>new Date()?"current":"expired",uploadedAt:permitDate.toISOString(),uploadedBy:"u1",uploadedByName:"Admin User",expires:expires.toISOString().split("T")[0],fileSize:"1.2 MB",notes:dept==="underground"?"County bore permit — 500ft max per day restriction":"ROW construction permit — Brightspeed corridor"});
 }
 // Easement — ~40% of jobs
 if(num%5<2){
  docs.push({id:`doc-${jobId}-e1`,type:"easement",name:`Easement_${feederId}_Parcel${1000+num}.pdf`,status:"current",uploadedAt:new Date(base-21*DAY).toISOString(),uploadedBy:"u1",uploadedByName:"Admin User",fileSize:"842 KB",notes:`Property owner: ${["Johnson","Williams","Garcia","Anderson","Thompson"][num%5]}. Access granted for construction.`});
 }
 // Make-Ready — most aerial jobs
 if(dept==="aerial"&&num%4!==3){
  docs.push({id:`doc-${jobId}-m1`,type:"make_ready",name:`MakeReady_${feederId}.pdf`,status:"current",uploadedAt:new Date(base-28*DAY).toISOString(),uploadedBy:"u1",uploadedByName:"Admin User",fileSize:"3.8 MB",notes:"Pole loading analysis complete. 2 poles require reinforcement."});
 }
 // Safety/JHA — if production submitted
 if(hasProd){
  docs.push({id:`doc-${jobId}-s1`,type:"safety",name:`JHA_${feederId}_${new Date(base).toISOString().split("T")[0]}.pdf`,status:"current",uploadedAt:new Date(base-DAY*0.5).toISOString(),uploadedBy:num%2===0?"u3":"u4",uploadedByName:num%2===0?"Matheus":"Wellington",fileSize:"520 KB",notes:"Pre-job hazard assessment. No high-risk conditions identified."});
 }
 // Completion Form — if approved/billed
 if(isComplete){
  docs.push({id:`doc-${jobId}-c1`,type:"completion",name:`Completion_${feederId}_Signed.pdf`,status:"current",uploadedAt:new Date(base+5*DAY).toISOString(),uploadedBy:"u1",uploadedByName:"Admin User",fileSize:"1.1 MB",notes:"Signed by crew lead and supervisor. All spans verified."});
 }
 // As-Built — if billed
 if(st==="Billed"){
  docs.push({id:`doc-${jobId}-ab1`,type:"as_built",name:`AsBuilt_${feederId}_Final.pdf`,status:"current",uploadedAt:new Date(base+10*DAY).toISOString(),uploadedBy:"u6",uploadedByName:"Vanderson",fileSize:"5.2 MB",notes:"Final as-built drawing. All deviations from design marked."});
 }
 // Photos — common for jobs with production
 if(hasProd&&num%3===0){
  docs.push({id:`doc-${jobId}-ph1`,type:"photo",name:`Photos_${feederId}_Pre.zip`,status:"current",uploadedAt:new Date(base-DAY*0.8).toISOString(),uploadedBy:num%2===0?"u3":"u4",uploadedByName:num%2===0?"Matheus":"Wellington",fileSize:"18.4 MB",notes:"Pre-construction photos. 12 images."});
  docs.push({id:`doc-${jobId}-ph2`,type:"photo",name:`Photos_${feederId}_Post.zip`,status:"current",uploadedAt:new Date(base+DAY*0.2).toISOString(),uploadedBy:num%2===0?"u3":"u4",uploadedByName:num%2===0?"Matheus":"Wellington",fileSize:"22.1 MB",notes:"Post-construction photos. 15 images."});
 }
 return docs;
}

const STATUS_CFG={Unassigned:{c:T.textDim,bg:"rgba(71,85,105,0.15)"},Assigned:{c:T.cyan,bg:T.cyanSoft},"Pending Redlines":{c:T.purple,bg:T.purpleSoft},"Under Client Review":{c:T.warning,bg:T.warningSoft},Rejected:{c:T.danger,bg:T.dangerSoft},"Ready to Invoice":{c:"#FACC15",bg:"rgba(250,204,21,0.12)"},Billed:{c:T.success,bg:T.successSoft}};
const REDLINE_CFG={"Not Uploaded":{c:T.textDim,bg:"rgba(71,85,105,0.15)"},Uploaded:{c:T.warning,bg:T.warningSoft},"Under Review":{c:T.purple,bg:T.purpleSoft},Approved:{c:T.success,bg:T.successSoft},Rejected:{c:T.danger,bg:T.dangerSoft}};
const FIN_CFG={Calculated:{c:T.success,bg:T.successSoft},"Missing Rate":{c:T.danger,bg:T.dangerSoft},"No Production":{c:T.textDim,bg:"rgba(71,85,105,0.15)"},"Mapping Needed":{c:T.warning,bg:T.warningSoft}};

const USERS=[
 {id:"u1",name:"Admin User",role:"admin",email:"admin@fiberlytic.com"},
 {id:"u2",name:"Sam Domaleski",role:"supervisor",email:"sam@fiberlytic.com",scope:{customer:"Brightspeed",region:"Alabama"},weeklySalary:1500,commissionRate:0.03},
 {id:"u3",name:"Matheus",role:"lineman",email:"matheus@fiberlytic.com"},
 {id:"u4",name:"Wellington",role:"lineman",email:"wellington@fiberlytic.com"},
 {id:"u5",name:"Donaldo",role:"lineman",email:"donaldo@fiberlytic.com"},
 {id:"u6",name:"Vanderson",role:"redline_specialist",email:"vanderson@fiberlytic.com"},
 {id:"u8",name:"Chris Kot",role:"billing",email:"chris@fiberlytic.com"},
 {id:"u9",name:"Roberto Vega",role:"truck_investor",email:"roberto@investor.com",trucks:["TRK-101","TRK-103","TRK-105"]},
 {id:"u10",name:"Frank Dillard",role:"truck_investor",email:"frank@investor.com",trucks:["TRK-102","TRK-106"]},
 {id:"u11",name:"Josh Grady",role:"foreman",email:"josh@fiberlytic.com"},
 {id:"u12",name:"Marcus Bell",role:"foreman",email:"marcus@fiberlytic.com"},
 {id:"u13",name:"Tony Reeves",role:"drill_investor",email:"tony@investor.com",drills:["DRL-201"]},
 {id:"u14",name:"Jean-Luc Beer",role:"client_manager",email:"jeanluc@mastec.com",scope:{client:"MasTec",customer:"Brightspeed",regions:["Alabama","Tennessee"]}},
];

const TRUCKS=[
 {id:"TRK-101",label:"TRK-101 · 2012 Ram 5500 Bucket Truck",vin:"3C7WDNBL9CG296559",owner:"Investor A",investorId:"u9",investorName:"Roberto Vega",compliance:{dotInspection:{date:"2025-08-15",expires:"2026-08-15"},insurance:{provider:"Progressive Commercial",policy:"PCM-4481920",expires:"2026-04-12"},registration:{state:"AL",expires:"2026-06-30"},oilChange:{last:"2025-12-10",nextDue:"2026-03-10",mileage:87420},tireInspection:{date:"2025-11-01",nextDue:"2026-05-01"}}},
 {id:"TRK-102",label:"TRK-102 · 2009 Ford F-550",vin:"1FDAF56R09EA32271",owner:"Investor B",investorId:"u10",investorName:"Frank Dillard",compliance:{dotInspection:{date:"2025-06-20",expires:"2026-02-20"},insurance:{provider:"Progressive Commercial",policy:"PCM-4481921",expires:"2026-05-30"},registration:{state:"AL",expires:"2026-03-15"},oilChange:{last:"2025-10-05",nextDue:"2026-01-05",mileage:124880},tireInspection:{date:"2025-09-15",nextDue:"2026-03-15"}}},
 {id:"TRK-103",label:"TRK-103 · 2008 Ford F-350",vin:"1FDWF36538EE36946",owner:"Investor A",investorId:"u9",investorName:"Roberto Vega",compliance:{dotInspection:{date:"2025-10-01",expires:"2026-10-01"},insurance:{provider:"State Farm Commercial",policy:"SFC-7712340",expires:"2026-07-22"},registration:{state:"AL",expires:"2026-09-30"},oilChange:{last:"2026-01-20",nextDue:"2026-04-20",mileage:98350},tireInspection:{date:"2025-12-15",nextDue:"2026-06-15"}}},
 {id:"TRK-104",label:"TRK-104 · 2019 Ford F-150",vin:"1FTFX1E50KKC11609",owner:"Company",investorId:null,investorName:null,compliance:{dotInspection:{date:"2025-11-10",expires:"2026-11-10"},insurance:{provider:"Progressive Commercial",policy:"PCM-4481922",expires:"2026-04-12"},registration:{state:"AL",expires:"2026-11-30"},oilChange:{last:"2026-01-05",nextDue:"2026-04-05",mileage:45200},tireInspection:{date:"2026-01-05",nextDue:"2026-07-05"}}},
 {id:"TRK-105",label:"TRK-105 · 2018 Ford F-150",vin:"1FTEW1EP4JKE96617",owner:"Investor A",investorId:"u9",investorName:"Roberto Vega",compliance:{dotInspection:{date:"2025-09-22",expires:"2026-09-22"},insurance:{provider:"Progressive Commercial",policy:"PCM-4481923",expires:"2026-04-12"},registration:{state:"AL",expires:"2026-08-31"},oilChange:{last:"2025-11-18",nextDue:"2026-02-18",mileage:62100},tireInspection:{date:"2025-10-20",nextDue:"2026-04-20"}}},
 {id:"TRK-106",label:"TRK-106 · 2016 Ford F-150",vin:"1FTEX1EP7GFA62192",owner:"Investor B",investorId:"u10",investorName:"Frank Dillard",compliance:{dotInspection:{date:"2025-07-30",expires:"2026-07-30"},insurance:{provider:"State Farm Commercial",policy:"SFC-7712341",expires:"2026-03-01"},registration:{state:"AL",expires:"2026-07-31"},oilChange:{last:"2025-12-22",nextDue:"2026-03-22",mileage:78950},tireInspection:{date:"2025-11-10",nextDue:"2026-05-10"}}},
 {id:"TRK-107",label:"TRK-107 · 2014 Chevrolet Silverado",vin:"1GCVKREH0EZ184071",owner:"Company",investorId:null,investorName:null,compliance:{dotInspection:{date:"2025-12-05",expires:"2026-12-05"},insurance:{provider:"Progressive Commercial",policy:"PCM-4481924",expires:"2026-04-12"},registration:{state:"AL",expires:"2026-12-31"},oilChange:{last:"2026-01-28",nextDue:"2026-04-28",mileage:112300},tireInspection:{date:"2025-12-01",nextDue:"2026-06-01"}}},
];

const DRILLS=[
 {id:"DRL-201",label:"DRL-201 · 2026 Vermeer D20x22 S3",owner:"Investor C",investorId:"u13",investorName:"Tony Reeves",compliance:{lastService:{date:"2026-01-15",nextDue:"2026-04-15",hours:320},hydraulicInspection:{date:"2025-12-01",nextDue:"2026-06-01"},bitReplacement:{date:"2026-01-20",bitsUsed:4,nextDue:"2026-03-20"}}},
 {id:"DRL-202",label:"DRL-202 · 2024 Ditch Witch JT20",owner:"Company",investorId:null,investorName:null,compliance:{lastService:{date:"2025-11-20",nextDue:"2026-02-20",hours:580},hydraulicInspection:{date:"2025-10-15",nextDue:"2026-04-15"},bitReplacement:{date:"2025-12-10",bitsUsed:6,nextDue:"2026-02-10"}}},
];

// CDL tracking for drivers
const CDL_DATA={
 u3:{cdlNumber:"AL-CDL-8834201",cdlClass:"A",state:"AL",expires:"2027-03-15",medicalCard:{expires:"2026-08-20"},endorsements:["N"]},
 u4:{cdlNumber:"AL-CDL-7721093",cdlClass:"B",state:"AL",expires:"2026-11-30",medicalCard:{expires:"2026-04-10"},endorsements:[]},
 u5:{cdlNumber:"AL-CDL-9912847",cdlClass:"A",state:"AL",expires:"2027-06-22",medicalCard:{expires:"2026-12-15"},endorsements:["N","T"]},
 u11:{cdlNumber:"AL-CDL-5543120",cdlClass:"A",state:"AL",expires:"2026-09-18",medicalCard:{expires:"2026-03-05"},endorsements:["N","H"]},
 u12:{cdlNumber:"AL-CDL-6678432",cdlClass:"B",state:"AL",expires:"2027-01-28",medicalCard:{expires:"2026-10-30"},endorsements:[]},
};

// ─── Material & Inventory System ────────────────────────────────────────────
const MATERIALS=[
 {id:"mat-fiber48",name:"Fiber Spool (48ct)",unit:"ft",unitCost:0.18,category:"fiber",restockThreshold:5000},
 {id:"mat-fiber96",name:"Fiber Spool (96ct)",unit:"ft",unitCost:0.28,category:"fiber",restockThreshold:3000},
 {id:"mat-strand",name:"Strand",unit:"ft",unitCost:0.08,category:"cable",restockThreshold:5000},
 {id:"mat-anchor",name:"Anchor Assembly",unit:"ea",unitCost:12.50,category:"hardware",restockThreshold:10},
 {id:"mat-coil",name:"Expansion Coil",unit:"ea",unitCost:6.75,category:"hardware",restockThreshold:8},
 {id:"mat-snowshoe",name:"Snowshoe Clamp",unit:"ea",unitCost:4.25,category:"hardware",restockThreshold:6},
 {id:"mat-conduit",name:"Conduit (1.25\")",unit:"ft",unitCost:0.45,category:"conduit",restockThreshold:2000},
 {id:"mat-lash-wire",name:"Lashing Wire",unit:"ft",unitCost:0.04,category:"cable",restockThreshold:8000},
];

function genPickups(){
 const now=Date.now(),DAY=86400000;
 const pickups=[];
 const warehouse="MasTec Warehouse — Huntsville, AL";
 // Generate pickups for each truck that has completed jobs
 TRUCKS.forEach((t,ti)=>{
 // 2-3 pickups per truck over last 30 days
 const count=2+(ti%2);
 for(let p=0;p<count;p++){
 const daysAgo=2+p*8+(ti*3)%10;
 const dt=new Date(now-daysAgo*DAY);
 const items=[
 {materialId:"mat-fiber48",qty:8000+(ti*1200+p*2000)%12000},
 {materialId:"mat-strand",qty:6000+(ti*900+p*1500)%10000},
 {materialId:"mat-anchor",qty:15+(ti*3+p*5)%25},
 {materialId:"mat-coil",qty:10+(ti*2+p*3)%15},
 {materialId:"mat-snowshoe",qty:6+(ti+p*2)%10},
 {materialId:"mat-lash-wire",qty:10000+(ti*2000+p*3000)%15000},
 ];
 if(ti%3===0)items.push({materialId:"mat-conduit",qty:2000+(p*1000)%3000});
 pickups.push({id:`PU-${String(ti*10+p+1).padStart(4,"0")}`,truckId:t.id,warehouse,date:dt.toISOString().split("T")[0],pickedUpBy:USERS.filter(u=>u.role==="lineman"||u.role==="foreman")[(ti+p)%5]?.name||"Unknown",items,
 signedOff:true,notes:p===0?"Weekly restock":"Mid-week top-up"});
 }
 });
 return pickups;
}

const GROUND_TYPES=["Normal","Cobble","Rock"];

// Underground foreman pay rates
const UG_PAY={fullDay:300,halfDay:150,conduitLt:0.25,conduitGt:0.30,weeklyBonusThreshold:4000,weeklyBonus:300};
const COIL_BONUS_FT=50; // Coil adds 50ft to the span's work type footage
const FEEDERS=["BSPD001.01DC","BSPD001.01G","BSPD001.04H","BSPD002.01A","BSPD002.03B","BSPD003.01DC","SPEC001.02A","SPEC001.03B","APBB001.01A","APBB002.01DC"];

// ─── RATE CARD ENGINE ────────────────────────────────────────────────────────
const CODE_MAP={};
const fillMap=(cl,cu,rg,pre)=>{const k=`${cl}|${cu}|${rg}`;CODE_MAP[k]={Overlash:pre+"LASH",Strand:pre+"STRAND",Fiber:pre+"FBR"};};
fillMap("MasTec","Brightspeed","Alabama","BSPD");fillMap("MasTec","Brightspeed","North Carolina","BSPD");
fillMap("MasTec","Spectrum","Alabama","SPEC");fillMap("MasTec","Spectrum","North Carolina","SPEC");
fillMap("MasTec","All Points Broadband","Virginia","APBB");fillMap("MasTec","All Points Broadband","Tennessee","APBB");
CLIENTS.forEach(cl=>CUSTOMERS.forEach(cu=>REGIONS.forEach(rg=>{if(!CODE_MAP[`${cl}|${cu}|${rg}`])CODE_MAP[`${cl}|${cu}|${rg}`]={Overlash:"GENLASH",Strand:"GENSTRAND",Fiber:"GENFBR"};})));

function genRateCards(){
 const g={};
 const cfgs=[
 {cl:"MasTec",cu:"Brightspeed",rg:"Alabama",pre:"BSPD",m:1.0},
 {cl:"MasTec",cu:"Brightspeed",rg:"North Carolina",pre:"BSPD",m:1.05},
 {cl:"MasTec",cu:"Brightspeed",rg:"Virginia",pre:"BSPD",m:1.02},
 {cl:"MasTec",cu:"Brightspeed",rg:"Tennessee",pre:"BSPD",m:0.98},
 {cl:"MasTec",cu:"Spectrum",rg:"Alabama",pre:"SPEC",m:0.95},
 {cl:"MasTec",cu:"Spectrum",rg:"North Carolina",pre:"SPEC",m:1.0},
 {cl:"MasTec",cu:"Spectrum",rg:"Virginia",pre:"SPEC",m:0.97},
 {cl:"MasTec",cu:"Spectrum",rg:"Tennessee",pre:"SPEC",m:0.93},
 {cl:"MasTec",cu:"All Points Broadband",rg:"Virginia",pre:"APBB",m:1.1},
 {cl:"MasTec",cu:"All Points Broadband",rg:"Tennessee",pre:"APBB",m:1.0},
 {cl:"MasTec",cu:"All Points Broadband",rg:"Alabama",pre:"APBB",m:1.03},
 {cl:"MasTec",cu:"All Points Broadband",rg:"North Carolina",pre:"APBB",m:1.07},
 ];
 const base=[
 // Aerial codes
 {suf:"LASH",desc:"Overlash",mapsTo:"Overlash",unit:"per foot",ng:1.65,lm:0.55,iv:0.08,dept:"aerial"},
 {suf:"STRAND",desc:"Strand",mapsTo:"Strand",unit:"per foot",ng:1.50,lm:0.50,iv:0.07,dept:"aerial"},
 {suf:"FBR",desc:"Fiber",mapsTo:"Fiber",unit:"per foot",ng:2.10,lm:0.70,iv:0.10,dept:"aerial"},
 {suf:"CNDPULL",desc:"Fiber Conduit Pulling",mapsTo:"Fiber Conduit Pulling",unit:"per foot",ng:1.35,lm:0.45,iv:0.06,dept:"aerial"},
 {suf:"ANCHOR",desc:"Anchor Install",mapsTo:"Anchor",unit:"per each",ng:75.00,lm:30.00,iv:4.00,dept:"aerial"},
 {suf:"COIL",desc:"Coil/Snowshoe",mapsTo:"Coil",unit:"per each",ng:40.00,lm:16.00,iv:2.00,dept:"aerial"},
 {suf:"ENTRY",desc:"Building Entry",mapsTo:"Entry",unit:"per each",ng:125.00,lm:50.00,iv:7.00,dept:"aerial"},
 // Underground boring codes
 {suf:"DBI",desc:"Directional Boring Initial",mapsTo:"DB-Normal",unit:"per foot",ng:12.50,lm:0,iv:0.15,dept:"underground"},
 {suf:"DBIC",desc:"Directional Boring Initial - Cobble",mapsTo:"DB-Cobble",unit:"per foot",ng:20.00,lm:0,iv:0.22,dept:"underground"},
 {suf:"DBIR",desc:"Directional Boring Initial - Rock",mapsTo:"DB-Rock",unit:"per foot",ng:85.00,lm:0,iv:0.75,dept:"underground"},
 {suf:"DBIA",desc:"Directional Boring Additional",mapsTo:"DB-Additional",unit:"per foot",ng:3.50,lm:0,iv:0.04,dept:"underground"},
 {suf:"DBIAR",desc:"Directional Boring Additional - Rock",mapsTo:"DB-Additional-Rock",unit:"per foot",ng:22.00,lm:0,iv:0.22,dept:"underground"},
 ];
 cfgs.forEach(c=>{
 const k=`${c.cl}|${c.cu}|${c.rg}`;
 const codes=base.map(b=>({code:c.pre+b.suf,description:b.desc,mapsTo:b.mapsTo,unit:b.unit}));
 const profiles={"NextGen Default":{},"Matheus":{},"Wellington":{},"Donaldo":{},"Josh Grady":{},"Marcus Bell":{},"Investor A":{},"Investor B":{},"Investor C":{},"Investor D":{}};
 codes.forEach(cd=>{const b=base.find(x=>cd.code.endsWith(x.suf));
 profiles["NextGen Default"][cd.code]={nextgenRate:+(b.ng*c.m).toFixed(2)};
 profiles["Matheus"][cd.code]={linemanRate:+(b.lm*c.m).toFixed(2)};
 profiles["Wellington"][cd.code]={linemanRate:+(b.lm*c.m*0.95).toFixed(2)};
 profiles["Donaldo"][cd.code]={linemanRate:+(b.lm*c.m*1.05).toFixed(2)};
 // Foremen don't use per-code lineman rates (they use day rate + conduit ft), but we store 0
 profiles["Josh Grady"][cd.code]={linemanRate:0};
 profiles["Marcus Bell"][cd.code]={linemanRate:0};
 profiles["Investor A"][cd.code]={investorRate:+(b.iv*c.m).toFixed(2)};
 profiles["Investor B"][cd.code]={investorRate:+(b.iv*c.m*1.1).toFixed(2)};
 profiles["Investor C"][cd.code]={investorRate:+(b.iv*c.m).toFixed(2)};
 profiles["Investor D"][cd.code]={investorRate:+(b.iv*c.m*0.95).toFixed(2)};
 });
 g[k]={id:k,client:c.cl,customer:c.cu,region:c.rg,codes,profiles,uploadedBy:"Admin User",uploadedAt:"2025-01-15T10:00:00Z",version:1,changeLog:["Initial rate card upload"]};
 });
 return g;
}

function calcJob(job,rc){
 if(!job.production)return{status:"No Production",items:[],totals:null};
 const src=job.confirmedTotals||job.production;
 const isConfirmed=!!job.confirmedTotals;
 const isBilled=!!job.billedAt;
 const gk=`${job.client}|${job.customer}|${job.region}`;
 const grp=rc[gk];
 if(!grp)return{status:"Missing Rate",error:`No rate card group: ${gk}`,items:[],totals:null};
 const ngP=grp.profiles["NextGen Default"];
 const lmUser=USERS.find(u=>u.id===job.assignedLineman);
 const lmP=lmUser?grp.profiles[lmUser.name]:null;

 if(job.department==="underground"){
 // ── UNDERGROUND CALC ──
 // NextGen revenue: ground type → billing code × footage
 // Foreman pay: day rate + conduit footage rate (NOT from rate card)
 // Drill investor: per-foot rate from rate card
 const ivP=job.drillInvestor?grp.profiles[job.drillInvestor]:null;
 const items=[];let miss=false;
 const gtMap={"Normal":"DB-Normal","Cobble":"DB-Cobble","Rock":"DB-Rock"};
 const gt=src.groundType||job.production.groundType||"Normal";
 const mapsTo=gtMap[gt]||"DB-Normal";
 const mainCode=grp.codes.find(c=>c.mapsTo===mapsTo);
 if(!mainCode)return{status:"Mapping Needed",error:`No code for ground type "${gt}"`,items:[],totals:null};
 const totalFt=src.totalFeet||0;
 // NextGen + investor revenue from boring code
 const nr=ngP?.[mainCode.code]?.nextgenRate??null;
 const ir=ivP?.[mainCode.code]?.investorRate??null;
 if(nr===null)miss=true;
 items.push({code:mainCode.code,description:`Directional Boring - ${gt}`,unit:"per foot",qty:totalFt,
 nextgenRate:nr,linemanRate:null,investorRate:ir,
 nextgenAmount:nr!==null?+(totalFt*nr).toFixed(2):null,linemanAmount:null,investorAmount:ir!==null?+(totalFt*ir).toFixed(2):null});
 // Foreman pay: computed from days
 const days=job.production.days||[];
 let fmPay=0;
 const fullDays=days.filter(d=>d.fullDay).length;
 const halfDays=days.filter(d=>d.halfDay).length;
 fmPay+=fullDays*UG_PAY.fullDay+halfDays*UG_PAY.halfDay;
 days.forEach(d=>{const ft=d.conduitFeet||0;fmPay+=ft>500?ft*UG_PAY.conduitGt:ft*UG_PAY.conduitLt;});
 const weekTotalFt=days.reduce((s,d)=>s+(d.conduitFeet||0),0);
 if(weekTotalFt>=UG_PAY.weeklyBonusThreshold)fmPay+=UG_PAY.weeklyBonus;
 if(miss)return{status:"Missing Rate",error:"Missing NextGen rate",items,totals:null};
 const tot={nextgenRevenue:+items.reduce((s,i)=>s+(i.nextgenAmount||0),0).toFixed(2),linemanPay:+fmPay.toFixed(2),investorCommission:+items.reduce((s,i)=>s+(i.investorAmount||0),0).toFixed(2)};
 tot.profit=+(tot.nextgenRevenue-tot.linemanPay-tot.investorCommission).toFixed(2);
 tot.margin=tot.nextgenRevenue>0?+((tot.profit/tot.nextgenRevenue)*100).toFixed(1):0;
 return{status:"Calculated",items,totals:tot,isConfirmed,isBilled,underground:true,fmPay:{fullDays,halfDays,conduitFeet:weekTotalFt,bonus:weekTotalFt>=UG_PAY.weeklyBonusThreshold}};
 }

 // ── AERIAL CALC ──
 const ivP=job.truckInvestor?grp.profiles[job.truckInvestor]:null;
 let miss=false;const items=[];
 const addItem=(cd,desc,unit,qty)=>{
 if(!cd||qty<=0)return;
 const nr=ngP?.[cd]?.nextgenRate??null;const lr=lmP?.[cd]?.linemanRate??null;const ir=ivP?.[cd]?.investorRate??null;
 if(nr===null)miss=true;
 items.push({code:cd,description:desc,unit,qty,nextgenRate:nr,linemanRate:lr,investorRate:ir,
 nextgenAmount:nr!==null?+(qty*nr).toFixed(2):null,linemanAmount:lr!==null?+(qty*lr).toFixed(2):null,investorAmount:ir!==null?+(qty*ir).toFixed(2):null});
 };
 // Compute footage per type from spans (coil adds COIL_BONUS_FT to span's work type)
 const spans=src.spans||(job.production?.spans)||[];
 let sfFt=0,ovlFt=0;
 spans.forEach(sp=>{
 const wt=sp.spanWorkType||"S+F";
 const ft=(sp.strandSpan||0)+(sp.coil?COIL_BONUS_FT:0);
 if(wt==="Overlash")ovlFt+=ft;
 else sfFt+=ft; // S+F: strand + fiber
 });
 // Fallback to stored totals if no spans
 if(spans.length===0){sfFt=src.totalStrand||src.totalFeet||0;ovlFt=src.totalOverlash||0;}
 // Strand footage line item
 const strandCode=grp.codes.find(c=>c.mapsTo==="Strand")?.code;
 if(strandCode&&sfFt>0)addItem(strandCode,"Strand (footage)","per foot",sfFt);
 // Fiber footage line item (same footage as strand for S+F spans)
 const fiberCode=grp.codes.find(c=>c.mapsTo==="Fiber")?.code;
 if(fiberCode&&sfFt>0)addItem(fiberCode,"Fiber (footage)","per foot",sfFt);
 // Overlash footage line item
 const ovlCode=grp.codes.find(c=>c.mapsTo==="Overlash")?.code;
 if(ovlCode&&ovlFt>0)addItem(ovlCode,"Overlash (footage)","per foot",ovlFt);
 // Anchors
 const ac=grp.codes.find(c=>c.mapsTo==="Anchor")?.code;
 if(ac&&(src.anchors||0)>0)addItem(ac,"Anchor Install","per each",src.anchors);
 // Coils + Snowshoes
 const cc=grp.codes.find(c=>c.mapsTo==="Coil")?.code;
 const cq=(src.coils||0)+(src.snowshoes||0);
 if(cc&&cq>0)addItem(cc,"Coil/Snowshoe","per each",cq);
 // Building entries
 const ec=grp.codes.find(c=>c.mapsTo==="Entry")?.code;
 if(ec&&(src.entries||0)>0)addItem(ec,"Building Entry","per each",src.entries);
 if(miss)return{status:"Missing Rate",error:"One or more rates missing",items,totals:null};
 const tot={nextgenRevenue:+items.reduce((s,i)=>s+(i.nextgenAmount||0),0).toFixed(2),linemanPay:+items.reduce((s,i)=>s+(i.linemanAmount||0),0).toFixed(2),investorCommission:+items.reduce((s,i)=>s+(i.investorAmount||0),0).toFixed(2)};
 tot.profit=+(tot.nextgenRevenue-tot.linemanPay-tot.investorCommission).toFixed(2);
 tot.margin=tot.nextgenRevenue>0?+((tot.profit/tot.nextgenRevenue)*100).toFixed(1):0;
 return{status:"Calculated",items,totals:tot,isConfirmed,isBilled};
}

// ─── Pay Period Helpers ──────────────────────────────────────────────────────
function getMonday(d){const dt=new Date(d);const day=dt.getDay();const diff=dt.getDate()-day+(day===0?-6:1);dt.setDate(diff);dt.setHours(0,0,0,0);return dt;}
function getSunday(mon){const s=new Date(mon);s.setDate(s.getDate()+6);return s;}
function payWeekKey(d){const m=getMonday(d);return `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,"0")}-${String(m.getDate()).padStart(2,"0")}`;}
function payWeekLabel(key){const[y,m,d]=key.split("-").map(Number);const mon=new Date(y,m-1,d);const sun=getSunday(mon);return `${fd(mon)} — ${fd(sun)}`;}
// Week numbering: weeks since a fixed epoch (Week 1 = Mon Jan 1 2024). Adjust epoch as needed.
const WEEK_EPOCH=new Date(2024,0,1);// Mon Jan 1 2024
function weekNumber(key){const[y,m,d]=key.split("-").map(Number);const mon=new Date(y,m-1,d);const diff=Math.floor((mon-WEEK_EPOCH)/(7*24*60*60*1000));return diff+1;}
function payDate(key){
 // Paid one month after the Sunday of the work week
 const[y,m,d]=key.split("-").map(Number);const sun=getSunday(new Date(y,m-1,d));
 const pd=new Date(sun);pd.setMonth(pd.getMonth()+1);return pd;
}
function getPayableWeeks(){
 // Work done Mon-Sun, paid one month later. Show last ~12 weeks for demo.
 const weeks=[];const now=new Date();
 for(let w=0;w<16;w++){const d=new Date(now);d.setDate(d.getDate()-w*7);const k=payWeekKey(d);if(!weeks.includes(k))weeks.push(k);}
 return weeks;
}

// ─── Seed Jobs ───────────────────────────────────────────────────────────────
function genJobs(){
 const jobs=[];const sts=Object.keys(STATUS_CFG);
 const lms=USERS.filter(u=>u.role==="lineman");
 const DAY=86400000;
 // For preview: simulate data as if generated on Thursday of current week
 const realNow=Date.now();const todayDay=new Date(realNow).getDay();
 const daysToThursday=todayDay<=4?(4-todayDay):(4-todayDay+7);
 const now=realNow+(daysToThursday*DAY);
 // Generate 80 jobs spread over ~6 months (180 days)
 for(let i=1;i<=80;i++){
 const cu=CUSTOMERS[i%3],rg=REGIONS[i%4],locs=LOCATIONS[rg]||["Unknown"];
 // First 6 are "Assigned" for lineman demo, rest cycle through statuses
 const st=i<=6?"Assigned":sts[(i-6)%sts.length];
 const lm=st==="Unassigned"?null:lms[i%lms.length];
 const hasProd=["Pending Redlines","Under Client Review","Ready to Invoice","Rejected","Billed"].includes(st);
 const hasRL=["Under Client Review","Ready to Invoice","Rejected","Billed"].includes(st);
 const isApp=["Ready to Invoice","Billed"].includes(st);
 let rls="Not Uploaded";if(hasRL&&st==="Under Client Review")rls="Under Review";else if(isApp)rls="Approved";else if(st==="Rejected")rls="Rejected";

 // Spread dates: simulate it being Thursday of the current week
 // Jobs 1-18: current week (Mon-Thu, 0-3 days back), 19-40: last 30 days, 41-80: last 180 days
 // First 6 still "Assigned" (no prod), but jobs 7-18 have production this week
 const daysBack=i<=18?Math.floor((i-1)*0.22):i<=40?4+((i-18)*1.2):30+((i-40)*2.8);
 const compDate=new Date(now-(daysBack*DAY));
 const schedDate=new Date(now-((daysBack+7)*DAY));
 // Vary footage realistically: 600-3500 ft
 const totalFeet=2000+Math.floor(((i*97+i*i*13)%6000));

 const isIlluminate=i%5===0; // Every 5th job is Illuminate
 const subName=isIlluminate?"Illuminate":"NextGen Fiber";
 jobs.push({id:`${String(i+1).padStart(4,"0")}`,department:"aerial",subcontractor:subName,client:"MasTec",customer:i===2?"Brightspeed":cu,region:i===2?"Alabama":rg,location:i===2?"Barkley Bridge Rd, Falkville, AL":locs[i%locs.length],olt:i===2?"FLVLALXA":OLTS[i%OLTS.length],feederId:FEEDERS[i%FEEDERS.length],workType:WORK_TYPES[i%WORK_TYPES.length],estimatedFootage:i===2?7190:totalFeet,
 poleCount:i===2?25:(5+Math.floor(Math.random()*18)),
 scheduledDate:schedDate.toISOString().split("T")[0],
 supervisorNotes:i%3===0?"Priority — complete ASAP.":i%3===1?"Standard route.":"",
 assignedLineman:lm?.id||null,assignedTruck:lm?TRUCKS[i%TRUCKS.length].id:null,truckInvestor:lm?TRUCKS[i%TRUCKS.length].owner:null,
 assignedDrill:null,drillInvestor:null,
 status:st,redlineStatus:rls,srNumber:isApp?`${1050000+i*31}`:null,
 production:hasProd?(()=>{
 const spanCount=2+(i%4);
 const spns=Array.from({length:spanCount},(_,s)=>{
 const spanFt=50+((i+s)*37)%300;
 const fiberNum=`${14500+((i+s)*143)%2500}${s%2===0?`.${14500+((i+s)*143)%2500+s*47}`:""}`;
 return{spanId:s+1,spanWorkType:s%5===2?"Overlash":"S+F",strandSpan:spanFt,anchora:s%3===0,fiberMarking:fiberNum,coil:s%4===0,poleTransfer:s%5===1,snowshoe:s%5===0};
 });
 const actTotal=spns.reduce((s,r)=>s+r.strandSpan+(r.coil?COIL_BONUS_FT:0),0);
 const sfTotal=spns.filter(r=>r.spanWorkType!=="Overlash").reduce((s,r)=>s+r.strandSpan+(r.coil?COIL_BONUS_FT:0),0);
 const ovlTotal=spns.filter(r=>r.spanWorkType==="Overlash").reduce((s,r)=>s+r.strandSpan+(r.coil?COIL_BONUS_FT:0),0);
 return{completedDate:compDate.toISOString().split("T")[0],totalFeet:actTotal,
 totalStrand:sfTotal,totalFiber:sfTotal,totalOverlash:ovlTotal,totalConduit:0,
 anchors:spns.filter(r=>r.anchora).length,coils:spns.filter(r=>r.coil).length,snowshoes:spns.filter(r=>r.snowshoe).length,poleTransfers:spns.filter(r=>r.poleTransfer).length,entries:spns.filter(r=>r.strandSpan||r.fiberMarking).length,
 spans:spns,
 submittedAt:new Date(compDate.getTime()+3600000).toISOString(),submittedBy:lm?.id||"u3",comments:i%5===0?"Rerouted around downed tree on span 3.":""};
 })():null,
 redlines:hasRL?[{version:1,fileName:`Redline_${FEEDERS[i%FEEDERS.length]}_v1.pdf`,uploadedAt:new Date(compDate.getTime()+7200000).toISOString(),uploadedBy:"u6",notes:"Initial redline."}]:[],
 reviewNotes:st==="Rejected"?"Span 2 footage mismatch. Re-verify.":"",
 confirmedTotals:hasRL?(()=>{const spanCount=2+(i%4);const actTotal=Array.from({length:spanCount},(_,s)=>50+((i+s)*37)%300).reduce((a,b)=>a+b,0);return{totalFeet:actTotal+([-30,-10,0,0,10,20][i%6]),totalStrand:actTotal+([-30,-10,0,0,10,20][i%6]),anchors:Math.ceil(spanCount/3),coils:Math.ceil(spanCount/4),snowshoes:Math.ceil(spanCount/5),poleTransfers:Math.floor(spanCount/5),entries:spanCount,confirmedBy:"u6",confirmedAt:new Date(compDate.getTime()+5400000).toISOString()};})():null,
 billedAt:st==="Billed"?new Date(compDate.getTime()+14*86400000).toISOString():null,
 mapPdf:i===2?"BSPD001_04H_Map.pdf":`Map_${FEEDERS[i%FEEDERS.length]}.pdf`,routePoles:i===2?[{id:"p295",label:"MRE#295",distToNext:262,lat:34.37280,lng:-86.90850},{id:"p296",label:"MRE#296",distToNext:279,lat:34.37030,lng:-86.90830},{id:"p299",label:"MRE#299",distToNext:322,lat:34.36760,lng:-86.90810},{id:"p300",label:"MRE#300",distToNext:319,lat:34.36460,lng:-86.90790},{id:"p301",label:"MRE#301",distToNext:201,lat:34.36270,lng:-86.90770},{id:"p302",label:"MRE#302",distToNext:292,lat:34.36080,lng:-86.90750},{id:"p303",label:"MRE#303",distToNext:240,lat:34.35800,lng:-86.90730},{id:"p304",label:"MRE#304",distToNext:270,lat:34.35580,lng:-86.90710},{id:"p305",label:"MRE#305",distToNext:357,lat:34.35300,lng:-86.90690},{id:"p306",label:"MRE#306",distToNext:204,lat:34.35110,lng:-86.90660},{id:"p307",label:"MRE#307",distToNext:296,lat:34.34920,lng:-86.90640},{id:"p308",label:"MRE#308",distToNext:488,lat:34.34640,lng:-86.90620},{id:"p309",label:"MRE#309",distToNext:379,lat:34.34270,lng:-86.90590},{id:"p310",label:"MRE#310",distToNext:453,lat:34.33910,lng:-86.90560},{id:"p311",label:"MRE#311",distToNext:129,lat:34.33790,lng:-86.90540},{id:"p312",label:"MRE#312",distToNext:213,lat:34.33590,lng:-86.90520},{id:"p313",label:"MRE#313",distToNext:462,lat:34.33160,lng:-86.90490},{id:"p314",label:"MRE#314",distToNext:212,lat:34.32960,lng:-86.90470},{id:"p315",label:"MRE#315",distToNext:146,lat:34.32820,lng:-86.90450},{id:"p316",label:"MRE#316",distToNext:297,lat:34.32540,lng:-86.90430},{id:"p317",label:"DSPLC",distToNext:0,lat:34.32260,lng:-86.90410}]:(st==="Assigned"||st==="Unassigned")?(()=>{const pc=8+(i%5);const regionCoords={Alabama:{lat:34.37,lng:-86.91},"North Carolina":{lat:35.75,lng:-81.68},Virginia:{lat:37.27,lng:-79.94},Tennessee:{lat:35.97,lng:-83.92}};const base=regionCoords[rg]||regionCoords.Alabama;return Array.from({length:pc},(_,pi)=>({id:`p${i}-${pi}`,label:`P${pi+1}`,distToNext:pi<pc-1?80+((i+pi)*37)%220:0,lat:base.lat-(pi*0.0019)+((i*0.0003)%0.002),lng:base.lng+(pi*0.0002)+((i*0.0001)%0.001)}));})():null,
 messages:hasProd?[
 {id:"m"+i+"a",userId:lm?.id||"u3",text:["Production submitted, all good.","Had to reroute span 3.","Completed ahead of schedule!","Weather delay but got it done.","Smooth run, no issues."][i%5],ts:new Date(compDate.getTime()+3600000).toISOString()},
 {id:"m"+i+"b",userId:"u1",text:["Looks great, sending to redline.","Nice work, keep it up!","Got it, thanks.","Solid numbers this week.","Approved, moving forward."][i%5],ts:new Date(compDate.getTime()+7200000).toISOString()},
 ]:[],
 auditLog:(()=>{const log=[{action:"job_created",actor:"u1",actorName:"Admin User",ts:new Date(compDate.getTime()-7*DAY).toISOString(),detail:"Job created and assigned."}];
 if(st!=="Unassigned")log.push({action:"assigned",actor:"u2",actorName:"Sam Domaleski",ts:new Date(compDate.getTime()-6*DAY).toISOString(),detail:`Assigned to ${lm?.name||"lineman"}, truck ${TRUCKS[i%TRUCKS.length].id}.`,from:"Unassigned",to:"Assigned"});
 if(hasProd)log.push({action:"production_submitted",actor:lm?.id||"u3",actorName:lm?.name||"Matheus",ts:new Date(compDate.getTime()+3600000).toISOString(),detail:`Production submitted: ${2000+Math.floor(((i*97+i*i*13)%6000))} ft.`,from:"Assigned",to:"Pending Redlines"});
 if(hasRL)log.push({action:"redline_uploaded",actor:"u6",actorName:"Vanderson",ts:new Date(compDate.getTime()+5400000).toISOString(),detail:"Redline v1 uploaded. Totals confirmed.",from:"Pending Redlines",to:"Pending Redlines"},{action:"submitted_for_review",actor:"u6",actorName:"Vanderson",ts:new Date(compDate.getTime()+6000000).toISOString(),detail:"Submitted for client review.",from:"Pending Redlines",to:"Under Client Review"});
 if(isApp)log.push({action:"approved",actor:"u14",actorName:"Jean-Luc Beer",ts:new Date(compDate.getTime()+8000000).toISOString(),detail:`Approved with SR# ${1050000+i*31}.`,from:"Under Client Review",to:"Ready to Invoice"});
 if(st==="Rejected")log.push({action:"rejected",actor:"u14",actorName:"Jean-Luc Beer",ts:new Date(compDate.getTime()+8000000).toISOString(),detail:"Rejected: Span 2 footage mismatch. Re-verify.",from:"Under Client Review",to:"Rejected"});
 if(st==="Billed")log.push({action:"billed",actor:"u8",actorName:"Chris Kot",ts:new Date(compDate.getTime()+14*DAY).toISOString(),detail:"Marked as billed. Invoice sent.",from:"Ready to Invoice",to:"Billed"});
 return log;})(),
 documents:seedDocs(String(i+1).padStart(4,"0"),st,compDate,FEEDERS[i%FEEDERS.length],"aerial"),
 createdAt:new Date(compDate.getTime()-7*DAY).toISOString(),updatedAt:compDate.toISOString()});
 }
 // ── Underground seed jobs ──
 const ugForemen=USERS.filter(u=>u.role==="foreman");
 const ugRuns=["BSPD001.02E","BSPD002.01UG","SPEC001.01UG","BSPD003.02UG","APBB001.02UG"];
 for(let i=1;i<=20;i++){
 const cu=CUSTOMERS[i%3],rg=REGIONS[i%4],locs=LOCATIONS[rg]||["Unknown"];
 const st=i<=3?"Assigned":sts[(i-3)%sts.length];
 const fm=st==="Unassigned"?null:ugForemen[i%ugForemen.length];
 const hasProd=["Pending Redlines","Under Client Review","Ready to Invoice","Rejected","Billed"].includes(st);
 const hasRL=["Under Client Review","Ready to Invoice","Rejected","Billed"].includes(st);
 const isApp=["Ready to Invoice","Billed"].includes(st);
 let rls="Not Uploaded";if(hasRL&&st==="Under Client Review")rls="Under Review";else if(isApp)rls="Approved";else if(st==="Rejected")rls="Rejected";
 const daysBack=i<=5?Math.floor(i*0.6):i<=12?(i-5)*2.5:20+((i-12)*4);
 const compDate=new Date(now-(daysBack*DAY));
 const totalFeet=400+Math.floor(((i*83+i*i*7)%1600));
 const gts=["Normal","Normal","Cobble","Normal","Rock"];
 const gt=gts[i%gts.length];
 const drill=DRILLS[i%DRILLS.length];
 const dayCount=hasProd?1+(i%5):0;
 const ugProd=hasProd?{completedDate:compDate.toISOString().split("T")[0],totalFeet,groundType:gt,
 days:Array.from({length:dayCount},(_,d)=>{const dayFt=Math.round(totalFeet/dayCount);
 return{dayNum:d+1,date:new Date(compDate.getTime()-d*DAY).toISOString().split("T")[0],fullDay:true,halfDay:false,conduitFeet:dayFt,groundType:gt};
 }),submittedAt:new Date(compDate.getTime()+3600000).toISOString(),submittedBy:fm?.id||"u11",comments:i%4===0?"Hit cobble at 200ft, switched bit.":""}:null;
 const ugSub=i%4===0?"Illuminate":"NextGen Fiber";
 jobs.push({id:`${String(5001+i).padStart(4,"0")}`,department:"underground",subcontractor:ugSub,client:"MasTec",customer:cu,region:rg,location:locs[i%locs.length],olt:OLTS[i%OLTS.length],feederId:ugRuns[i%ugRuns.length],workType:"Underground Boring",
 scheduledDate:new Date(now-((daysBack+7)*DAY)).toISOString().split("T")[0],
 supervisorNotes:i%3===0?"Priority bore — road crossing.":"",
 assignedLineman:fm?.id||null,assignedTruck:null,truckInvestor:null,
 assignedDrill:fm?drill.id:null,drillInvestor:fm?drill.owner:null,
 status:st,redlineStatus:rls,srNumber:isApp?`${1060000+i*31}`:null,
 production:ugProd,
 redlines:hasRL?[{version:1,fileName:`Redline_${ugRuns[i%ugRuns.length]}_v1.pdf`,uploadedAt:new Date(compDate.getTime()+7200000).toISOString(),uploadedBy:"u6",notes:"Initial redline."}]:[],
 reviewNotes:st==="Rejected"?"Footage discrepancy — re-verify bore log.":"",
 confirmedTotals:hasRL?{totalFeet:totalFeet+([-20,-5,0,0,5,10][i%6]),confirmedBy:"u6",confirmedAt:new Date(compDate.getTime()+5400000).toISOString()}:null,
 billedAt:st==="Billed"?new Date(compDate.getTime()+14*86400000).toISOString():null,
 mapPdf:`Map_${ugRuns[i%ugRuns.length]}.pdf`,messages:[],
 documents:seedDocs(String(5001+i).padStart(4,"0"),st,compDate,ugRuns[i%ugRuns.length],"underground"),
 auditLog:(()=>{const log=[{action:"job_created",actor:"u1",actorName:"Admin User",ts:new Date(compDate.getTime()-7*DAY).toISOString(),detail:"Underground job created."}];
 if(st!=="Unassigned")log.push({action:"assigned",actor:"u2",actorName:"Sam Domaleski",ts:new Date(compDate.getTime()-6*DAY).toISOString(),detail:`Assigned to ${fm?.name||"foreman"}, drill ${drill.id}.`,from:"Unassigned",to:"Assigned"});
 if(hasProd)log.push({action:"production_submitted",actor:fm?.id||"u11",actorName:fm?.name||"Josh Grady",ts:new Date(compDate.getTime()+3600000).toISOString(),detail:`Production submitted: ${totalFeet} ft, ground type: ${gt}.`,from:"Assigned",to:"Pending Redlines"});
 if(hasRL)log.push({action:"redline_uploaded",actor:"u6",actorName:"Vanderson",ts:new Date(compDate.getTime()+5400000).toISOString(),detail:"Redline v1 uploaded. Totals confirmed.",from:"Pending Redlines",to:"Pending Redlines"},{action:"submitted_for_review",actor:"u6",actorName:"Vanderson",ts:new Date(compDate.getTime()+6000000).toISOString(),detail:"Submitted for client review.",from:"Pending Redlines",to:"Under Client Review"});
 if(isApp)log.push({action:"approved",actor:"u14",actorName:"Jean-Luc Beer",ts:new Date(compDate.getTime()+8000000).toISOString(),detail:`Approved with SR# ${1060000+i*31}.`,from:"Under Client Review",to:"Ready to Invoice"});
 if(st==="Rejected")log.push({action:"rejected",actor:"u14",actorName:"Jean-Luc Beer",ts:new Date(compDate.getTime()+8000000).toISOString(),detail:"Rejected: Footage discrepancy — re-verify bore log.",from:"Under Client Review",to:"Rejected"});
 if(st==="Billed")log.push({action:"billed",actor:"u8",actorName:"Chris Kot",ts:new Date(compDate.getTime()+14*DAY).toISOString(),detail:"Marked as billed.",from:"Ready to Invoice",to:"Billed"});
 return log;})(),
 createdAt:new Date(compDate.getTime()-7*DAY).toISOString(),updatedAt:compDate.toISOString()});
 }
 return jobs;
}

// ─── GPS Distance Calculator (Haversine) ────────────────────────────────────
function gpsDistance(lat1,lon1,lat2,lon2){
 const R=3280.84;// feet per meter * earth radius → use meters first
 const toRad=d=>d*Math.PI/180;
 const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
 const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
 return Math.round(6371000*c*3.28084);// meters→feet
}
function gpsVerifyStatus(gpsDistance,reportedFt){
 if(!gpsDistance||!reportedFt)return{status:"none",label:"No GPS",color:T.textDim};
 const diff=Math.abs(gpsDistance-reportedFt)/reportedFt;
 if(diff<=0.10)return{status:"verified",label:"GPS Verified",color:T.success};
 if(diff<=0.25)return{status:"close",label:"GPS Close",color:T.warning};
 return{status:"mismatch",label:"GPS Mismatch",color:T.danger};
}

// ─── Live Mode Map Component ────────────────────────────────────────────────
function LiveModeMap({ job, liveSession, setLiveSession, onSubmit, pf, setPf, currentUser }) {
 const mapRef = useRef(null);
 const mapInstance = useRef(null);
 const markersRef = useRef([]);
 const userMarkerRef = useRef(null);
 const gpsWatchRef = useRef(null);
 const [userPos, setUserPos] = useState(null);
 const [gpsAccuracy, setGpsAccuracy] = useState(null);
 const [gpsError, setGpsError] = useState(null);
 const [mapReady, setMapReady] = useState(false);

 const poles = job.routePoles || [];
 const spans = liveSession?.spans || [];
 const GPS_RADIUS_M = 50; // Proximity radius for pole selection

 // Initialize map
 useEffect(() => {
  if (!mapRef.current || poles.length === 0) return;
  if (mapInstance.current) return;

  // Calculate bounds from poles
  const lngs = poles.map(p => p.lng).filter(Boolean);
  const lats = poles.map(p => p.lat).filter(Boolean);
  if (lngs.length === 0) return;

  const map = new maplibregl.Map({
   container: mapRef.current,
   style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "&copy; OpenStreetMap" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
   center: [lngs.reduce((a, b) => a + b, 0) / lngs.length, lats.reduce((a, b) => a + b, 0) / lats.length],
   zoom: 14,
   attributionControl: false,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", () => {
   // Add route line source
   const routeCoords = poles.filter(p => p.lat && p.lng).map(p => [p.lng, p.lat]);
   map.addSource("route", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: routeCoords }, properties: {} } });
   map.addLayer({ id: "route-bg", type: "line", source: "route", paint: { "line-color": "#555555", "line-width": 3, "line-dasharray": [2, 2] } });

   // Completed spans layer
   map.addSource("completed-spans", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
   map.addLayer({ id: "completed-spans-layer", type: "line", source: "completed-spans", paint: { "line-width": 5 } });

   // GPS accuracy circle
   map.addSource("gps-accuracy", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} } });
   map.addLayer({ id: "gps-accuracy-circle", type: "circle", source: "gps-accuracy", paint: { "circle-radius": 20, "circle-color": "rgba(59, 130, 246, 0.1)", "circle-stroke-color": "rgba(59, 130, 246, 0.3)", "circle-stroke-width": 1 } });

   setMapReady(true);

   // Fit to bounds
   const bounds = new maplibregl.LngLatBounds();
   routeCoords.forEach(c => bounds.extend(c));
   map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
  });

  mapInstance.current = map;
  return () => { map.remove(); mapInstance.current = null; };
 }, [poles.length]);

 // Update pole markers when session changes
 useEffect(() => {
  if (!mapInstance.current || !mapReady) return;
  // Clear old markers
  markersRef.current.forEach(m => m.remove());
  markersRef.current = [];

  poles.forEach((pole, pi) => {
   if (!pole.lat || !pole.lng) return;
   const completedSpan = spans.find(s => s.toPole === pole.id);
   const isStart = liveSession?.startPole === pole.id;
   const isCurrent = liveSession?.currentPole === pole.id;
   const isCompleted = !!completedSpan || isStart;
   const nextIdx = liveSession?.currentPole ? poles.findIndex(p => p.id === liveSession.currentPole) + 1 : -1;
   const isNext = liveSession && nextIdx === pi && !isCompleted;

   // Determine color
   let color = "#6B7280"; // gray - pending
   let size = 14;
   if (isCurrent) { color = "#4ADE80"; size = 20; } // green - current
   else if (isCompleted) { color = "#22C55E"; size = 16; } // green - done
   else if (isNext) { color = "#FACC15"; size = 18; } // yellow - next

   const el = document.createElement("div");
   el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;transition:all 0.3s;`;
   if (isCurrent) el.style.cssText += `box-shadow:0 0 0 8px rgba(74,222,128,0.25),0 2px 8px rgba(0,0,0,0.4);`;
   if (isNext) el.style.cssText += `box-shadow:0 0 0 6px rgba(250,204,21,0.2),0 2px 8px rgba(0,0,0,0.4);`;

   // Label
   const label = document.createElement("div");
   label.style.cssText = `position:absolute;top:${size+4}px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,0.7);padding:1px 5px;border-radius:3px;pointer-events:none;`;
   label.textContent = pole.label || `P${pi + 1}`;
   el.appendChild(label);

   const marker = new maplibregl.Marker({ element: el }).setLngLat([pole.lng, pole.lat]).addTo(mapInstance.current);
   markersRef.current.push(marker);
  });
 }, [mapReady, liveSession?.startPole, liveSession?.currentPole, spans.length]);

 // Update completed spans on map
 useEffect(() => {
  if (!mapInstance.current || !mapReady) return;
  const features = spans.map(sp => {
   const from = poles.find(p => p.id === sp.fromPole);
   const to = poles.find(p => p.id === sp.toPole);
   if (!from?.lat || !to?.lat) return null;
   const wt = sp.workTypes?.[0] || "S+F";
   const color = wt === "Overlash" ? "#22C55E" : wt === "Fiber" ? "#C084FC" : wt === "Strand" ? "#F0F0F0" : "#3B82F6";
   return { type: "Feature", geometry: { type: "LineString", coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }, properties: { color } };
  }).filter(Boolean);

  const src = mapInstance.current.getSource("completed-spans");
  if (src) src.setData({ type: "FeatureCollection", features });

  // Update paint to use data-driven color
  if (mapInstance.current.getLayer("completed-spans-layer")) {
   mapInstance.current.setPaintProperty("completed-spans-layer", "line-color", ["get", "color"]);
  }
 }, [mapReady, spans.length]);

 // GPS tracking
 useEffect(() => {
  if (!navigator.geolocation) { setGpsError("GPS not available"); return; }
  const id = navigator.geolocation.watchPosition(
   (pos) => {
    setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setGpsAccuracy(pos.coords.accuracy);
    setGpsError(null);
   },
   (err) => setGpsError(err.message),
   { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );
  gpsWatchRef.current = id;
  return () => navigator.geolocation.clearWatch(id);
 }, []);

 // Update user position marker on map
 useEffect(() => {
  if (!mapInstance.current || !mapReady || !userPos) return;
  if (!userMarkerRef.current) {
   const el = document.createElement("div");
   el.style.cssText = "width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,0.2),0 2px 6px rgba(0,0,0,0.3);";
   userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([userPos.lng, userPos.lat]).addTo(mapInstance.current);
  } else {
   userMarkerRef.current.setLngLat([userPos.lng, userPos.lat]);
  }
  // Update accuracy circle
  const accSrc = mapInstance.current.getSource("gps-accuracy");
  if (accSrc) accSrc.setData({ type: "Feature", geometry: { type: "Point", coordinates: [userPos.lng, userPos.lat] }, properties: {} });
 }, [mapReady, userPos]);

 // Handle pole click
 const handlePoleClick = useCallback((pole, pi) => {
  if (!liveSession) return;
  // Set start pole
  if (!liveSession.startPole) {
   setLiveSession({ ...liveSession, startPole: pole.id, currentPole: pole.id });
   if (mapInstance.current) mapInstance.current.flyTo({ center: [pole.lng, pole.lat], zoom: 16, duration: 800 });
   return;
  }
  const isCurrent = liveSession.currentPole === pole.id;
  const isCompleted = spans.some(s => s.toPole === pole.id) || liveSession.startPole === pole.id;
  const nextIdx = poles.findIndex(p => p.id === liveSession.currentPole) + 1;
  const isNext = nextIdx === pi && !isCompleted;
  if (isCurrent || (!isNext && !isCompleted)) return;

  if (isNext) {
   const fromPole = liveSession.currentPole;
   const fromIdx = poles.findIndex(p => p.id === fromPole);
   const dist = poles[fromIdx]?.distToNext || 0;
   setLiveSession({
    ...liveSession,
    currentPole: pole.id,
    spans: [...liveSession.spans, { fromPole, toPole: pole.id, workTypes: [liveSession.workType], footage: dist, anchor: false, coil: false, snowshoe: false, poleTransfer: false, fiberSeq: "" }]
   });
   if (mapInstance.current) mapInstance.current.flyTo({ center: [pole.lng, pole.lat], zoom: 16, duration: 600 });
  }
 }, [liveSession, poles, spans]);

 const totalFt = spans.reduce((s, sp) => s + sp.footage, 0);
 const progress = poles.length > 1 ? Math.round((spans.length / (poles.length - 1)) * 100) : 0;

 return (
  <div>
   {/* Map Header */}
   <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
     <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Live Mode — {job.feederId}</div>
      <div style={{ fontSize: 11, color: T.textMuted }}>{poles.length} poles · {poles.reduce((s, p) => s + (p.distToNext || 0), 0).toLocaleString()} ft total</div>
     </div>
     <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {gpsAccuracy && <span style={{ fontSize: 10, color: gpsAccuracy < 15 ? T.success : gpsAccuracy < 30 ? T.warning : T.danger, fontWeight: 600 }}>GPS ±{Math.round(gpsAccuracy)}m</span>}
      {!liveSession?<Btn onClick={()=>setLiveSession({startPole:null,currentPole:null,spans:[],workType:"S+F"})} style={{background:T.success}}>Start Build</Btn>:<Badge label="● LIVE" color={T.success} bg={T.successSoft}/>}
     </div>
    </div>

    {/* Work Type Selector */}
    {liveSession && <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 4 }}>
     {["S+F", "Overlash", "Fiber", "Strand"].map(wt => {
      const active = liveSession.workType === wt;
      const wtC = { "S+F": "#3B82F6", Overlash: "#22C55E", Fiber: "#C084FC", Strand: "#F0F0F0" }[wt] || T.accent;
      return <button key={wt} onClick={() => setLiveSession({ ...liveSession, workType: wt })} style={{ padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${active ? wtC : T.border}`, background: active ? wtC + "18" : "transparent", color: active ? wtC : T.textDim, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{wt === "S+F" ? "S+F" : wt === "Overlash" ? "OVL" : wt === "Fiber" ? "FBR" : "STR"}</button>;
     })}
    </div>}

    {/* Map Container */}
    <div ref={mapRef} style={{ width: "100%", height: 400, position: "relative" }}>
     {gpsError && <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, padding: "6px 12px", borderRadius: 6, background: "rgba(248,113,113,0.9)", color: "#fff", fontSize: 11, fontWeight: 600 }}>GPS: {gpsError}</div>}
    </div>

    {/* Progress Bar */}
    {liveSession && <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
     <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
      <span style={{ color: T.textMuted }}>Progress</span>
      <span style={{ fontWeight: 700, color: T.text }}>{spans.length}/{poles.length - 1} spans · {progress}%</span>
     </div>
     <div style={{ height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${progress}%`, borderRadius: 2, background: T.success, transition: "width 0.4s ease" }} />
     </div>
    </div>}
   </div>

   {/* Pole List (compact, below map) */}
   <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, color: T.text }}>Pole Route</div>
    <div style={{ maxHeight: 280, overflow: "auto" }}>
     {poles.map((pole, pi) => {
      const completedSpan = spans.find(s => s.toPole === pole.id);
      const isStart = liveSession?.startPole === pole.id;
      const isCurrent = liveSession?.currentPole === pole.id;
      const isCompleted = !!completedSpan || (isStart && pi === 0);
      const nextIdx = liveSession?.currentPole ? poles.findIndex(p => p.id === liveSession.currentPole) + 1 : -1;
      const isNext = liveSession && nextIdx === pi && !isCompleted;
      const borderColor = isCurrent ? T.success : isStart && pi === 0 ? T.accent : isCompleted ? T.success + "66" : isNext ? T.warning : T.border;

      return <div key={pole.id}>
       {pi > 0 && completedSpan && <div style={{ display: "flex", alignItems: "center", padding: "0 14px", gap: 6 }}>
        <div style={{ flex: 1, height: 2, background: T.success }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: T.success, fontFamily: "monospace" }}>{completedSpan.footage} ft</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: { "S+F": "#3B82F6", Overlash: "#22C55E", Fiber: "#C084FC", Strand: T.accent }[completedSpan.workTypes?.[0]] || T.textDim }}>{completedSpan.workTypes?.[0] || "S+F"}</span>
        <div style={{ flex: 1, height: 2, background: T.success }} />
       </div>}
       <div onClick={() => handlePoleClick(pole, pi)} style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, cursor: liveSession ? "pointer" : "default", background: isCurrent ? T.success + "12" : isCompleted ? T.success + "06" : "transparent", borderLeft: `4px solid ${borderColor}` }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${isCurrent ? T.success : isCompleted ? T.success : T.border}`, background: isCurrent ? T.success : isCompleted ? T.success + "33" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isCurrent ? "#fff" : isCompleted ? T.success : T.textMuted, flexShrink: 0 }}>{isCompleted ? "✓" : pi + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
         <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{pole.label || `P${pi + 1}`}</div>
         {isCurrent && <div style={{ fontSize: 10, color: T.success, fontWeight: 600 }}>● Current position</div>}
         {isNext && <div style={{ fontSize: 10, color: T.warning, fontWeight: 600 }}>Tap when reached</div>}
        </div>
        {/* Hardware toggles for completed spans */}
        {completedSpan && <div style={{ display: "flex", gap: 3 }}>
         {[{ k: "anchor", l: "A", c: T.warning }, { k: "coil", l: "C", c: "#3B82F6" }, { k: "snowshoe", l: "S", c: T.success }, { k: "poleTransfer", l: "PT", c: T.orange }].map(att => {
          const si = spans.findIndex(s => s.toPole === pole.id);
          const active = si >= 0 && spans[si][att.k];
          return <button key={att.k} onClick={e => { e.stopPropagation(); if (si < 0) return; const ns = [...spans]; ns[si] = { ...ns[si], [att.k]: !ns[si][att.k] }; setLiveSession({ ...liveSession, spans: ns }); }} style={{ width: 24, height: 24, borderRadius: 4, border: `1.5px solid ${active ? att.c : T.border}`, background: active ? att.c + "18" : "transparent", color: active ? att.c : T.textDim, fontSize: 8, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{att.l}</button>;
         })}
        </div>}
       </div>
      </div>;
     })}
    </div>
   </div>

   {/* Session Summary */}
   {liveSession && spans.length > 0 && <div style={{ background: T.bgCard, border: `1px solid ${T.success}44`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 10 }}>Session Summary</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginBottom: 12 }}>
     <div style={{ padding: 8, background: T.bgInput, borderRadius: 6, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{totalFt.toLocaleString()}</div><div style={{ fontSize: 9, color: T.textMuted }}>Total Feet</div></div>
     <div style={{ padding: 8, background: T.bgInput, borderRadius: 6, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>{spans.length}</div><div style={{ fontSize: 9, color: T.textMuted }}>Spans</div></div>
     <div style={{ padding: 8, background: T.bgInput, borderRadius: 6, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: T.warning }}>{spans.filter(s => s.anchor).length}</div><div style={{ fontSize: 9, color: T.textMuted }}>Anchors</div></div>
     <div style={{ padding: 8, background: T.bgInput, borderRadius: 6, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#3B82F6" }}>{spans.filter(s => s.coil).length}</div><div style={{ fontSize: 9, color: T.textMuted }}>Coils</div></div>
     <div style={{ padding: 8, background: T.bgInput, borderRadius: 6, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: T.success }}>{spans.filter(s => s.snowshoe).length}</div><div style={{ fontSize: 9, color: T.textMuted }}>Snowshoes</div></div>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
     <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 4 }}>Date Completed</label><input type="date" value={pf.completedDate} onChange={e => setPf({ ...pf, completedDate: e.target.value })} style={{ width: "100%", boxSizing: "border-box", background: T.bgInput, color: T.text, border: `1px solid ${T.border}`, borderRadius: 4, padding: "10px 12px", fontSize: 13, outline: "none" }} /></div>
     <button onClick={onSubmit} disabled={!pf.completedDate} style={{ alignSelf: "flex-end", padding: "10px 20px", borderRadius: 6, border: "none", background: !pf.completedDate ? T.border : T.success, color: !pf.completedDate ? T.textDim : "#fff", fontSize: 13, fontWeight: 700, cursor: pf.completedDate ? "pointer" : "default" }}>Submit Live Production</button>
    </div>
   </div>}
  </div>
 );
}

// ─── Compliance Helpers ─────────────────────────────────────────────────────
function complianceStatus(dateStr){
 if(!dateStr)return{status:"unknown",label:"No Date",color:T.textDim,days:null};
 const now=new Date();const exp=new Date(dateStr);
 const days=Math.ceil((exp-now)/(1000*60*60*24));
 if(days<0)return{status:"expired",label:`Expired ${Math.abs(days)}d ago`,color:T.danger,days};
 if(days<=7)return{status:"critical",label:`${days}d left`,color:T.danger,days};
 if(days<=30)return{status:"warning",label:`${days}d left`,color:T.warning,days};
 if(days<=60)return{status:"upcoming",label:`${days}d left`,color:T.text,days};
 return{status:"good",label:`${days}d left`,color:T.success,days};
}
function compBadge(dateStr){
 const s=complianceStatus(dateStr);
 return <span style={{padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,color:s.color,background:s.color+"18"}}>{s.label}</span>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const Ctx=createContext();const useApp=()=>useContext(Ctx);

// ─── UI Primitives ───────────────────────────────────────────────────────────
const $=n=>n==null?"—":"$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const pc=n=>n==null?"—":n.toFixed(1)+"%";
const fd=(d)=>{if(!d)return"—";const dt=new Date(d);if(isNaN(dt))return d;return String(dt.getMonth()+1).padStart(2,"0")+"/"+String(dt.getDate()).padStart(2,"0")+"/"+dt.getFullYear();};
const fdt=(d)=>{if(!d)return"—";const dt=new Date(d);if(isNaN(dt))return d;return fd(d)+" "+dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});};
function Badge({label,color,bg}){return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 6px",borderRadius:2,fontSize:10,fontWeight:700,color,background:bg,letterSpacing:0.4,whiteSpace:"nowrap",textTransform:"uppercase"}}>{label}</span>;}
function SB({status,cfg=STATUS_CFG}){const s=cfg[status]||{c:T.textMuted,bg:"rgba(100,116,139,0.1)"};return <Badge label={status} color={s.c} bg={s.bg}/>;}
function FB({status}){const s=FIN_CFG[status]||{c:T.textMuted,bg:"rgba(100,116,139,0.1)"};return <Badge label={status} color={s.c} bg={s.bg}/>;}

function Card({children,style,onClick,hover}){
 return <div onClick={onClick} className={hover?"card-hover":undefined} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:4,padding:20,cursor:onClick?"pointer":"default",transition:"background 0.15s, border-color 0.15s",...style}}>{children}</div>;
}
function Btn({children,onClick,v="primary",sz="md",style,disabled}){
 const[h,setH]=useState(false);
 const vs={primary:{bg:"#111111",bgH:"#333333",c:"#fff"},success:{bg:T.success,bgH:"#059669",c:"#fff"},danger:{bg:T.danger,bgH:"#B91C1C",c:"#fff"},ghost:{bg:"transparent",bgH:T.bgInput,c:T.text},outline:{bg:"transparent",bgH:T.accentSoft,c:T.text,bdr:`1px solid ${T.border}`}};
 const vv=vs[v];const szs={sm:{p:"5px 12px",f:12},md:{p:"8px 18px",f:13},lg:{p:"10px 24px",f:14}};const ss=szs[sz];
 return <button disabled={disabled} onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:disabled?T.bgInput:h?vv.bgH:vv.bg,color:disabled?T.textDim:vv.c,border:vv.bdr||"none",borderRadius:4,fontWeight:600,cursor:disabled?"not-allowed":"pointer",transition:"all 0.2s",letterSpacing:0.2,padding:ss.p,fontSize:ss.f,...style}}>{children}</button>;
}
function Inp({label,value,onChange,type="text",ph,disabled,style,options,textarea}){
 const bs={width:"100%",boxSizing:"border-box",background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4,padding:"8px 12px",fontSize:13,outline:"none"};
 return <div style={{marginBottom:12,...style}}>
 {label&&<label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:5,letterSpacing:0.4,textTransform:"uppercase"}}>{label}</label>}
 {options?<select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} style={{...bs,cursor:disabled?"not-allowed":"pointer"}}><option value="">Select...</option>{options.map(o=><option key={typeof o==="object"?o.value:o} value={typeof o==="object"?o.value:o}>{typeof o==="object"?o.label:o}</option>)}</select>
 :textarea?<textarea value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} placeholder={ph} rows={3} style={{...bs,resize:"vertical"}}/>
 :<input type={type} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} placeholder={ph} style={bs} onFocus={e=>(e.target.style.borderColor=T.borderFocus)} onBlur={e=>(e.target.style.borderColor=T.border)}/>}
 </div>;
}
function Modal({open,onClose,title,children,width=560}){
 const{isMobile:_m}=useApp();
 if(!open)return null;
 return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:_m?"flex-end":"center",justifyContent:"center"}} onClick={onClose}>
 <div style={{position:"absolute",inset:0,background:"rgba(26,31,46,0.4)",backdropFilter:"blur(6px)"}}/>
 <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:_m?"12px 12px 0 0":6,width:_m?"100%":width,maxWidth:_m?"100%":"92vw",maxHeight:_m?"92vh":"88vh",overflow:"auto",padding:_m?20:28,boxShadow:"0 16px 48px rgba(0,0,0,0.12)"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:_m?14:20}}>
 <h2 style={{margin:0,fontSize:_m?16:18,fontWeight:700,color:T.text}}>{title}</h2>
 <button onClick={onClose} style={{background:T.bgInput,border:`1px solid ${T.border}`,color:T.textMuted,cursor:"pointer",fontSize:14,padding:"4px 8px",borderRadius:4,lineHeight:1}}>✕</button>
 </div>{children}
 </div>
 </div>;
}
function DT({columns,data,onRowClick,expandedId,renderExpanded}){
 const{isMobile:_m}=useApp();
 const mobileHide=["olt","feederId","compDate","lm","sr","fin","feet"];
 const visCols=_m?columns.filter(c=>!mobileHide.includes(c.key)):columns;
 return <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",borderRadius:4,border:`1px solid ${T.border}`}}>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:_m?12:13}}>
 <thead><tr style={{background:T.bgInput}}>
 {visCols.map(c=><th key={c.key} style={{textAlign:"left",padding:_m?"8px 8px":"10px 14px",color:T.textMuted,fontWeight:500,fontSize:_m?10:11,textTransform:"uppercase",letterSpacing:0.4,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{c.label}</th>)}
 </tr></thead>
 <tbody>
 {data.map((row,ri)=>{const isExp=expandedId&&expandedId===row.id;return <React.Fragment key={ri}>
 <tr onClick={()=>onRowClick?.(row)} style={{cursor:onRowClick?"pointer":"default",borderBottom:isExp?"none":`1px solid ${T.border}`,transition:"background 0.1s",background:isExp?T.accentSoft:"transparent"}} onMouseEnter={e=>{if(!_m&&!isExp)e.currentTarget.style.background=T.bgCardHover;}} onMouseLeave={e=>{if(!_m&&!isExp)e.currentTarget.style.background=isExp?T.accentSoft:"transparent";}}>
 {visCols.map(c=><td key={c.key} style={{padding:_m?"8px 8px":"10px 14px",color:T.text,whiteSpace:"nowrap"}}>{c.render?c.render(row):row[c.key]}</td>)}
 </tr>
 {isExp&&renderExpanded&&<tr><td colSpan={visCols.length} style={{padding:0,borderBottom:`1px solid ${T.border}`}}>{renderExpanded(row)}</td></tr>}
 </React.Fragment>;})}
 {data.length===0&&<tr><td colSpan={visCols.length} style={{padding:40,textAlign:"center",color:T.textDim}}>No data found</td></tr>}
 </tbody>
 </table>
 </div>;
}
function TabBar({tabs,active,onChange}){const{isMobile:_m}=useApp();return <div style={{display:"flex",gap:2,background:T.bgInput,borderRadius:4,padding:3,marginBottom:_m?12:20,overflowX:_m?"auto":"visible",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>{tabs.map(t=><button key={t.key} onClick={()=>onChange(t.key)} style={{flex:_m?"0 0 auto":1,padding:_m?"7px 12px":"8px 14px",fontSize:_m?11:12,fontWeight:600,borderRadius:3,border:"none",cursor:"pointer",background:active===t.key?T.bgCard:"transparent",color:active===t.key?T.text:T.textMuted,transition:"all 0.15s",boxShadow:active===t.key?`0 1px 2px rgba(0,0,0,0.04)`:"none",whiteSpace:"nowrap"}}>{t.label}</button>)}</div>;}
function SC({label,value,color,icon,sub}){const{isMobile:_m}=useApp();return <Card style={{flex:1,minWidth:_m?100:155,padding:_m?12:16,borderLeft:`3px solid ${color||T.accent}`}}><div><div style={{fontSize:_m?18:22,fontWeight:700,color:T.text,lineHeight:1,letterSpacing:-0.3}}>{value}</div><div style={{fontSize:_m?9:10,color:T.textMuted,marginTop:_m?3:4,fontWeight:500,textTransform:"uppercase",letterSpacing:0.3}}>{label}</div>{sub&&<div style={{fontSize:_m?9:10,color:T.textDim,marginTop:2}}>{sub}</div>}</div></Card>;}
const FR=(l,v)=><div style={{display:"flex",flexWrap:"wrap",borderBottom:`1px solid ${T.border}22`,padding:"8px 0"}}><span style={{width:130,minWidth:100,fontSize:12,color:T.textMuted,fontWeight:600}}>{l}</span><span style={{fontSize:13,color:T.text,fontWeight:500,flex:1,minWidth:0}}>{v||"—"}</span></div>;

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard(){
 const{jobs,rateCards,currentUser,tickets,trucks,drills,setView,setSelectedJob,setNavFrom,setJobsPreFilter,isMobile:_m}=useApp();
 const navigateTo=(target,preFilter,label)=>{setNavFrom({view:"dashboard",label:"Dashboard"});if(preFilter)setJobsPreFilter(preFilter);setView(target);};
 const[fl,setFl]=useState({customer:"",region:"",lineman:"",investor:"",status:""});
 const[period,setPeriod]=useState("month");
 const isR=["lineman","foreman","redline_specialist","client_manager","truck_investor","drill_investor"].includes(currentUser.role);
 const investors=[...new Set(jobs.map(j=>j.truckInvestor).filter(Boolean))];

 // Time period boundaries
 const now=new Date();
 const periodStart=useMemo(()=>{
 if(period==="week"){return getMonday(now);}
 if(period==="month"){return new Date(now.getFullYear(),now.getMonth(),1);}
 if(period==="year"){return new Date(now.getFullYear(),0,1);}
 return new Date(2020,0,1);// all
 },[period]);
 const periodLabel=period==="week"?"This Week":period==="month"?"This Month":period==="year"?`${now.getFullYear()}`:"All Time";

 const d=useMemo(()=>{
 let fj=[...jobs];
 if(fl.customer)fj=fj.filter(j=>j.customer===fl.customer);
 if(fl.region)fj=fj.filter(j=>j.region===fl.region);
 if(fl.lineman)fj=fj.filter(j=>j.assignedLineman===fl.lineman);
 if(fl.investor)fj=fj.filter(j=>j.truckInvestor===fl.investor);
 if(fl.status)fj=fj.filter(j=>j.status===fl.status);

 // All jobs for workload (unfiltered by time)
 const allJobs=fj;
 const bySt={};allJobs.forEach(j=>{bySt[j.status]=(bySt[j.status]||0)+1;});

 // Time-filtered jobs for financials
 const tfj=fj.filter(j=>{
 if(!j.production?.completedDate)return false;
 return new Date(j.production.completedDate)>=periodStart;
 });

 let tRev=0,tPay=0,tComm=0,calc=0,miss=0,noProd=0,tFeet=0;
 const byCust={},byLm={},byWeek={};
 // Count all job stats
 let allCalc=0,allMiss=0,allNoProd=0,allFeet=0;
 allJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated")allCalc++;else if(f.status==="No Production")allNoProd++;else allMiss++;
 if(j.production?.totalFeet)allFeet+=j.production.totalFeet;});

 tfj.forEach(j=>{
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){calc++;tRev+=f.totals.nextgenRevenue;tPay+=f.totals.linemanPay;tComm+=f.totals.investorCommission;
 tFeet+=j.production?.totalFeet||0;
 if(!byCust[j.customer])byCust[j.customer]={rev:0,pay:0,comm:0,profit:0,n:0,feet:0};
 byCust[j.customer].rev+=f.totals.nextgenRevenue;byCust[j.customer].pay+=f.totals.linemanPay;byCust[j.customer].comm+=f.totals.investorCommission;byCust[j.customer].profit+=f.totals.profit;byCust[j.customer].n++;byCust[j.customer].feet+=j.production?.totalFeet||0;
 const ln=USERS.find(u=>u.id===j.assignedLineman)?.name||"Unassigned";
 if(!byLm[ln])byLm[ln]={pay:0,rev:0,n:0,profit:0,feet:0};byLm[ln].pay+=f.totals.linemanPay;byLm[ln].rev+=f.totals.nextgenRevenue;byLm[ln].profit+=f.totals.profit;byLm[ln].n++;byLm[ln].feet+=j.production?.totalFeet||0;
 const wk=payWeekKey(new Date(j.production.completedDate));
 if(!byWeek[wk])byWeek[wk]={rev:0,profit:0,pay:0,n:0,feet:0};
 byWeek[wk].rev+=f.totals.nextgenRevenue;byWeek[wk].profit+=f.totals.profit;byWeek[wk].pay+=f.totals.linemanPay;byWeek[wk].n++;byWeek[wk].feet+=j.production?.totalFeet||0;
 }
 });
 const tProfit=+(tRev-tPay-tComm).toFixed(2);const margin=tRev>0?+((tProfit/tRev)*100).toFixed(1):0;
 const weekData=Object.entries(byWeek).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>({key:k,wn:weekNumber(k),...v}));
 return{fj:allJobs,tfj,tRev,tPay,tComm,tProfit,margin,calc,miss:allMiss,noProd:allNoProd,allCalc,byCust,byLm,bySt,weekData,tFeet,allFeet};
 },[jobs,rateCards,fl,periodStart]);

 const topProducer=Object.entries(d.byLm).sort((a,b)=>b[1].rev-a[1].rev)[0];

 return <div>
 <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"flex-start",marginBottom:_m?10:16,gap:_m?6:10}}>
 <div>
 <h1 style={{fontSize:_m?17:20,fontWeight:600,margin:0,color:T.text}}>Dashboard</h1>
 <p style={{color:T.textMuted,fontSize:_m?11:13,margin:"4px 0 0"}}>{d.fj.length} total jobs · {periodLabel}</p>
 </div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",width:_m?"100%":undefined}}>
 {/* Time period toggle */}
 <div style={{display:"flex",borderRadius:4,overflow:"hidden",border:`1px solid ${T.border}`,marginRight:_m?0:8,flex:_m?"1 1 100%":undefined}}>
 {[{k:"week",l:"Week"},{k:"month",l:"Month"},{k:"year",l:"Year"},{k:"all",l:_m?"All":"All Time"}].map(p=>
 <button key={p.k} onClick={()=>setPeriod(p.k)} style={{
 padding:_m?"7px 8px":"7px 12px",border:"none",fontSize:_m?10:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",flex:_m?1:undefined,
 background:period===p.k?T.accent:"transparent",color:period===p.k?"#fff":T.textMuted,
 }}>{p.l}</button>
 )}
 </div>
 <Inp value={fl.customer} onChange={v=>setFl({...fl,customer:v})} options={CUSTOMERS} ph="Select..." style={{marginBottom:0,minWidth:_m?0:100,fontSize:11,flex:_m?"1 1 45%":undefined}}/>
 <Inp value={fl.region} onChange={v=>setFl({...fl,region:v})} options={REGIONS} ph="Select..." style={{marginBottom:0,minWidth:_m?0:100,fontSize:11,flex:_m?"1 1 45%":undefined}}/>
 {(fl.customer||fl.region||fl.status)&&<Btn v="ghost" sz="sm" onClick={()=>setFl({customer:"",region:"",lineman:"",investor:"",status:""})}>✕</Btn>}
 </div>
 </div>

 {!isR&&<>
 {/* ── ACTION ITEMS — what needs your attention right now ── */}
 {(()=>{
 const unassignedJobs=jobs.filter(j=>j.status==="Unassigned");
 const openTicketsList=(tickets||[]).filter(t=>t.status==="Open"||t.status==="Acknowledged");
 const reviewJobs=jobs.filter(j=>j.status==="Under Client Review");
 const readyBill=jobs.filter(j=>j.status==="Ready to Invoice");
 const compAlerts=[];
 (trucks||[]).forEach(t=>{const c=t.compliance;if(!c)return;[{d:c.dotInspection?.expires,l:"DOT"},{d:c.insurance?.expires,l:"Insurance"},{d:c.registration?.expires,l:"Reg"},{d:c.oilChange?.nextDue,l:"Oil"},{d:c.tireInspection?.nextDue,l:"Tires"}].forEach(x=>{const s=complianceStatus(x.d);if(s.status==="expired"||s.status==="critical")compAlerts.push({item:t.id,type:x.l,status:s});});});
 const totalActions=unassignedJobs.length+openTicketsList.length+compAlerts.length;
 return totalActions>0&&<div style={{display:"grid",gridTemplateColumns:_m?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:16}}>
 <Card hover onClick={()=>navigateTo("jobs","Unassigned")} style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.accent}`}}>
 <div style={{fontSize:24,fontWeight:600,color:unassignedJobs.length>0?T.text:T.textDim}}>{unassignedJobs.length}</div>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:500}}>Unassigned Jobs</div>
 {unassignedJobs.length>0&&<div style={{fontSize:10,color:T.accent,marginTop:4}}>Need crew assignment</div>}
 </Card>
 <Card hover onClick={()=>navigateTo("tickets")} style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.accent}`}}>
 <div style={{fontSize:24,fontWeight:600,color:openTicketsList.length>0?T.text:T.textDim}}>{openTicketsList.length}</div>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:500}}>Open Tickets</div>
 {openTicketsList.filter(t=>t.priority==="urgent").length>0&&<div style={{fontSize:10,color:T.accent,marginTop:4,fontWeight:600}}>{openTicketsList.filter(t=>t.priority==="urgent").length} urgent</div>}
 </Card>
 <Card hover onClick={()=>navigateTo("jobs","Ready to Invoice")} style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.accent}`}}>
 <div style={{fontSize:24,fontWeight:600,color:readyBill.length>0?T.text:T.textDim}}>{readyBill.length}</div>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:500}}>Ready to Invoice</div>
 {readyBill.length>0&&<div style={{fontSize:10,color:T.accent,marginTop:4}}>{$(readyBill.reduce((s,j)=>{const f=calcJob(j,rateCards);return s+(f.totals?.nextgenRevenue||0);},0))} revenue</div>}
 </Card>
 <Card hover onClick={()=>navigateTo("compliance")} style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.accent}`}}>
 <div style={{fontSize:24,fontWeight:600,color:compAlerts.length>0?T.text:T.textDim}}>{compAlerts.length}</div>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:500}}>Compliance Alerts</div>
 {compAlerts.filter(a=>a.status.status==="expired").length>0&&<div style={{fontSize:10,color:T.accent,marginTop:4,fontWeight:600}}>{compAlerts.filter(a=>a.status.status==="expired").length} expired</div>}
 </Card>
 </div>;
 })()}
 {/* ── FOOTAGE GOAL TRACKER — the CEO dopamine hit ── */}
 {(()=>{
 const goalMap={week:75000,month:300000,year:3600000,all:10000000};
 const goal=goalMap[period]||200000;
 const goalPct=Math.min((d.tFeet/goal)*100,100);
 const goalLabel=goal>=1000000?`${(goal/1000000).toFixed(1)}M`:`${(goal/1000).toFixed(0)}k`;
 const feetLabel=d.tFeet>=1000000?`${(d.tFeet/1000000).toFixed(2)}M`:d.tFeet>=1000?`${(d.tFeet/1000).toFixed(1)}k`:String(d.tFeet);
 const hit=d.tFeet>=goal;
 const revPerFt=d.tFeet>0?(d.tRev/d.tFeet):0;
 const profPerFt=d.tFeet>0?(d.tProfit/d.tFeet):0;
 return <Card style={{marginBottom:_m?12:16,padding:0,overflow:"hidden",borderColor:hit?T.success+"55":T.accent+"33"}}>
 <div style={{padding:_m?"14px 14px 12px":"20px 24px 16px",background:T.bgCard}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:_m?10:16,flexWrap:_m?"wrap":"nowrap",gap:_m?8:0}}>
 <div>
 <div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:6}}>{periodLabel} Footage Goal</div>
 <div style={{display:"flex",alignItems:"baseline",gap:_m?4:8}}>
 <span style={{fontSize:_m?30:44,fontWeight:600,color:hit?T.success:T.text,lineHeight:1,letterSpacing:-2}}>{feetLabel}</span>
 <span style={{fontSize:_m?12:16,fontWeight:600,color:T.textMuted}}>/ {goalLabel} ft</span>
 </div>
 {hit
 ?<div style={{fontSize:_m?11:13,fontWeight:700,color:T.success,marginTop:6,display:"flex",alignItems:"center",gap:5}}>Target Exceeded {((d.tFeet/goal)*100).toFixed(0)}%</div>
 :<div style={{fontSize:_m?11:12,color:T.textMuted,marginTop:6}}>{(goal-d.tFeet).toLocaleString()} ft remaining · {(goalPct).toFixed(1)}%</div>
 }
 </div>
 <div style={{textAlign:_m?"left":"right"}}>
 <div style={{fontSize:_m?22:32,fontWeight:600,color:T.success,lineHeight:1}}>{$(d.tRev)}</div>
 <div style={{fontSize:10,color:T.textMuted,marginTop:4}}>Revenue · {periodLabel.toLowerCase()}</div>
 <div style={{fontSize:_m?14:18,fontWeight:600,color:T.accent,marginTop:_m?4:6}}>{$(d.tProfit)}</div>
 <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>Profit · {pc(d.margin)} margin</div>
 </div>
 </div>
 {/* Big goal progress bar */}
 <div style={{position:"relative",marginBottom:4}}>
 <div style={{height:28,borderRadius:6,background:"rgba(59,130,246,0.10)",overflow:"hidden",position:"relative",border:"1px solid rgba(59,130,246,0.08)"}}>
 <div style={{height:"100%",borderRadius:6,
 background:hit?T.success:T.accent,
 width:`${goalPct}%`,transition:"width 0.8s ease",
 
 }}/>
 <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:goalPct>45?"#fff":T.text}}>
 {Math.round(goalPct)}%
 </div>
 </div>
 <div style={{position:"relative",height:14,marginTop:3}}>
 {[25,50,75,100].map(m=>{
 const reached=goalPct>=m;
 return <div key={m} style={{position:"absolute",left:`${m}%`,transform:"translateX(-50%)",fontSize:8,fontWeight:700,color:reached?T.success:T.textDim}}>
 {m===100?"":""}{goal*m/100>=1000000?`${(goal*m/100/1000000).toFixed(1)}M`:`${(goal*m/100/1000).toFixed(0)}k`}
 </div>;
 })}
 </div>
 </div>
 </div>
 <div style={{display:"flex",flexWrap:_m?"wrap":"nowrap",borderTop:`1px solid ${T.border}`}}>
 {(()=>{
 const aerialJobs=d.tfj.filter(j=>j.department==="aerial");
 const ugJobs=d.tfj.filter(j=>j.department==="underground");
 const aerialFeet=aerialJobs.reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 const ugFeet=ugJobs.reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 const billedJobs=d.fj.filter(j=>j.status==="Billed").length;
 const readyToInvoice=d.fj.filter(j=>j.status==="Ready to Invoice").length;
 const avgJobValue=d.calc>0?(d.tRev/d.calc):0;
 const items=[
 {l:"Jobs Completed",v:String(d.calc)},
 {l:"Avg Job Value",v:$(avgJobValue)},
 {l:"Aerial Footage",v:aerialFeet>=1000?`${(aerialFeet/1000).toFixed(1)}k ft`:`${aerialFeet} ft`},
 {l:"Underground Footage",v:ugFeet>=1000?`${(ugFeet/1000).toFixed(1)}k ft`:`${ugFeet} ft`},
 {l:"Ready to Invoice",v:String(readyToInvoice)},
 {l:"Total Jobs",v:String(d.fj.length)},
 ];
 return items.map((s,i)=><div key={i} style={{flex:_m?"1 1 33%":1,padding:_m?"8px 6px":"10px 8px",textAlign:"center",borderRight:_m?(i%3<2?`1px solid ${T.border}`:"none"):(i<5?`1px solid ${T.border}`:"none"),borderBottom:_m&&i<3?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:_m?13:15,fontWeight:600,color:T.text}}>{s.v}</div>
 <div style={{fontSize:_m?8:9,color:T.textMuted,marginTop:1}}>{s.l}</div>
 </div>);
 })()}
 </div>
 </Card>;
 })()}




 {/* ── P&L BREAKDOWN + TOP PERFORMERS ── */}
 <div style={{display:"grid",gridTemplateColumns:_m?"1fr":"1fr 1fr",gap:14,marginBottom:16}}>
 {/* Revenue by Customer */}
 <Card style={{padding:"18px 20px"}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Revenue by Customer</h3>
 {Object.entries(d.byCust).length===0?<p style={{color:T.textDim,fontSize:13}}>No calculated jobs</p>:
 Object.entries(d.byCust).sort((a,b)=>b[1].rev-a[1].rev).map(([c,v])=>{
 const pct=d.tRev>0?((v.rev/d.tRev)*100):0;
 return <div key={c} style={{marginBottom:14}}>
 <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
 <span style={{fontSize:13,fontWeight:600,color:T.text}}>{c}</span>
 <span style={{fontSize:14,fontWeight:600,color:T.success}}>{$(v.rev)}</span>
 </div>
 <div style={{height:6,borderRadius:3,background:T.bgInput,overflow:"hidden",marginBottom:4}}>
 <div style={{height:"100%",width:`${pct}%`,borderRadius:3,background:T.accent}}/>
 </div>
 <div style={{display:"flex",gap:12,fontSize:11,color:T.textMuted}}>
 <span>Profit: <b style={{color:T.success}}>{$(v.profit)}</b></span>
 <span>Pay: {$(v.pay)}</span>
 <span>{v.n} jobs</span>
 </div>
 </div>;
 })}
 </Card>

 {/* Crew Performance */}
 <Card style={{padding:"18px 20px"}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Crew Performance</h3>
 {Object.entries(d.byLm).sort((a,b)=>b[1].rev-a[1].rev).map(([n,v],i)=>{
 const isTop=i===0;
 return <div key={n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 {isTop&&<svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>}
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{n}{isTop&&<span style={{fontSize:10,color:T.success,marginLeft:6}}>Top Performer</span>}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{v.n} jobs · Revenue: {$(v.rev)}</div>
 </div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:14,fontWeight:700,color:T.success}}>{$(v.profit)}</div>
 <div style={{fontSize:10,color:T.textMuted}}>profit generated</div>
 </div>
 </div>;
 })}
 </Card>
 </div>

 {/* ── CREW WORKLOAD ── */}
 <div style={{marginBottom:0}}>
 <Card style={{padding:"18px 20px"}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Crew Workload</h3>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
 {USERS.filter(u=>u.role==="lineman").map(l=>{
 const n=d.fj.filter(j=>j.assignedLineman===l.id).length;const a=d.fj.filter(j=>j.assignedLineman===l.id&&j.status==="Assigned").length;
 const done=d.fj.filter(j=>j.assignedLineman===l.id&&j.production).length;
 return <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{l.name}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{a} active · {done} completed · {n} total</div>
 </div>
 {(()=>{const pct=n>0?Math.round((done/n)*100):0;const r=20;const circ=2*Math.PI*r;const offset=circ-(pct/100)*circ;return <div style={{position:"relative",width:50,height:50}}>
 <svg width={50} height={50} style={{transform:"rotate(-90deg)"}}><circle cx={25} cy={25} r={r} fill="none" stroke={T.border} strokeWidth={3}/><circle cx={25} cy={25} r={r} fill="none" stroke={n>0?T.accent:T.border} strokeWidth={3} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{transition:"stroke-dashoffset 0.6s ease"}}/></svg>
 <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:n>0?T.accent:T.textDim}}>{pct}%</span>
 </div>;})()}
 </div>;
 })}
 </div>
 </Card>
 </div>

 {/* ── TODAY'S ACTIVITY + RECENT TICKETS ── */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:16}}>
 {/* Recent Production */}
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <h3 style={{fontSize:13,fontWeight:600,color:T.text,margin:0}}>Recent Production</h3>
 <span style={{fontSize:10,color:T.textDim}}>Latest submissions</span>
 </div>
 <div style={{maxHeight:240,overflowY:"auto"}}>
 {jobs.filter(j=>j.production?.submittedAt).sort((a,b)=>b.production.submittedAt.localeCompare(a.production.submittedAt)).slice(0,8).map(j=>{
 const crew=USERS.find(u=>u.id===j.production.submittedBy);
 const hrs=Math.round((now-new Date(j.production.submittedAt))/3600000);
 const ago=hrs<1?"now":hrs<24?hrs+"h":Math.round(hrs/24)+"d";
 return <div key={j.id} className="card-hover" onClick={()=>{setSelectedJob(j);setView("job_detail");}} style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer",display:"flex",gap:10,alignItems:"center"}}>
 <div style={{width:28,height:28,borderRadius:6,background:j.department==="underground"?T.orangeSoft:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:j.department==="underground"?T.orange:T.accent,flexShrink:0}}>{(crew?.name||"?").split(" ").map(n=>n[0]).join("")}</div>
 <div style={{flex:1,minWidth:0}}>
 <div style={{fontSize:12,color:T.text}}><b style={{color:T.accent,fontFamily:"monospace"}}>{j.feederId}</b> · {j.production.totalFeet?.toLocaleString()} ft</div>
 <div style={{fontSize:10,color:T.textDim}}>{crew?.name} · {j.region}</div>
 </div>
 <div style={{textAlign:"right",flexShrink:0}}><SB status={j.status}/><div style={{fontSize:9,color:T.textDim,marginTop:2}}>{ago}</div></div>
 </div>;})}
 </div>
 </Card>

 {/* Recent Tickets */}
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <h3 style={{fontSize:13,fontWeight:600,color:T.text,margin:0}}>Recent Tickets</h3>
 <button onClick={()=>navigateTo("tickets")} style={{fontSize:10,color:T.accent,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>View All →</button>
 </div>
 <div style={{maxHeight:240,overflowY:"auto"}}>
 {(tickets||[]).sort((a,b)=>{const so={Open:0,Acknowledged:1,Resolved:2};return(so[a.status]||2)-(so[b.status]||2)||b.createdAt.localeCompare(a.createdAt);}).slice(0,6).map(t=>{
 const TSC2={Open:{c:T.warning,bg:T.warningSoft},Acknowledged:{c:T.accent,bg:T.accentSoft},Resolved:{c:T.success,bg:T.successSoft}};
 const TPC2={urgent:{c:T.danger,l:"URGENT"},high:{c:T.warning,l:"HIGH"},normal:{c:T.textMuted,l:""}};
 const stc=TSC2[t.status]||{c:T.textMuted,bg:"transparent"};const prc=TPC2[t.priority]||TPC2.normal;
 const lastMsg=t.messages[t.messages.length-1];
 return <div key={t.id} className="card-hover" onClick={()=>navigateTo("tickets")} style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer",borderLeft:`3px solid ${stc.c}`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
 <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
 {prc.l&&<span style={{fontSize:8,fontWeight:700,color:prc.c,background:prc.c+"18",padding:"1px 4px",borderRadius:3}}>{prc.l}</span>}
 <span style={{fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject}</span>
 </div>
 <Badge label={t.status} color={stc.c} bg={stc.bg}/>
 </div>
 <div style={{fontSize:10,color:T.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastMsg.from}: {lastMsg.text.slice(0,60)}</div>
 </div>;})}
 </div>
 </Card>
 </div>
 </>}

 {/* Restricted roles see simpler view */}
 {isR&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
 <SC label="Total Jobs" value={d.fj.length} color={T.accent} icon="$"/>
 <SC label="Calculated" value={d.calc} color={T.success} icon="$"/>
 </div>}
 </div>;
}

// ─── RATE CARDS VIEW ─────────────────────────────────────────────────────────
function RateCardsView(){
 const{rateCards,setRateCards}=useApp();
 const[sel,setSel]=useState(null);const[prof,setProf]=useState("NextGen Default");
 const[editM,setEditM]=useState(null);const[editV,setEditV]=useState("");const[impM,setImpM]=useState(false);
 const[showCreate,setShowCreate]=useState(false);
 const[newRC,setNewRC]=useState({client:"",customer:"",region:""});
 const[showAddCode,setShowAddCode]=useState(false);
 const[newCode,setNewCode]=useState({code:"",description:"",mapsTo:"",unit:"per foot"});
 const groups=Object.values(rateCards);const grp=sel?rateCards[sel]:null;
 const profNames=grp?Object.keys(grp.profiles):[];
 const profType=prof==="NextGen Default"?"nextgen":USERS.some(u=>u.name===prof&&(u.role==="lineman"||u.role==="foreman"))?"lineman":"investor";
 const rField=profType==="nextgen"?"nextgenRate":profType==="lineman"?"linemanRate":"investorRate";
 const rateLabel=profType==="nextgen"?"Company Rate":profType==="lineman"?"Pay Rate":"Investor Rate";
 const allMapsTo=[...WORK_TYPES,"—"];

 const handleSave=()=>{if(!editM)return;const{gk,code,pn,field,isCodeField}=editM;const nc={...rateCards};const g={...nc[gk]};
 if(isCodeField){
 g.codes=g.codes.map(c=>c.code===code?{...c,[field]:editV}:c);
 g.changeLog=[...(g.changeLog||[]),`Updated ${code} ${field} to "${editV}"`];
 } else {
 const p={...g.profiles};const pr={...p[pn]};
 pr[code]={...pr[code],[field]:parseFloat(editV)||0};p[pn]=pr;g.profiles=p;
 g.changeLog=[...(g.changeLog||[]),`Updated ${code} ${field} in ${pn} to ${editV}`];
 }
 g.version=(g.version||1)+1;g.uploadedAt=new Date().toISOString();nc[gk]=g;setRateCards(nc);setEditM(null);};

 const createRateCard=()=>{
 if(!newRC.client.trim()||!newRC.customer.trim()||!newRC.region.trim())return;
 const k=`${newRC.client}|${newRC.customer}|${newRC.region}`;
 if(rateCards[k])return;
 const nc={...rateCards};
 nc[k]={id:k,client:newRC.client,customer:newRC.customer,region:newRC.region,codes:[],
 profiles:{"NextGen Default":{}},uploadedBy:"Admin User",uploadedAt:new Date().toISOString(),version:1,changeLog:["Rate card created"]};
 setRateCards(nc);setShowCreate(false);setNewRC({client:"",customer:"",region:""});setSel(k);
 };

 const addCode=()=>{
 if(!newCode.code.trim()||!sel)return;
 const nc={...rateCards};const g={...nc[sel]};
 if(g.codes.some(c=>c.code===newCode.code))return;
 g.codes=[...g.codes,{code:newCode.code,description:newCode.description,mapsTo:newCode.mapsTo,unit:newCode.unit}];
 Object.keys(g.profiles).forEach(pn=>{g.profiles[pn]={...g.profiles[pn],[newCode.code]:{[pn==="NextGen Default"?"nextgenRate":USERS.some(u=>u.name===pn&&(u.role==="lineman"||u.role==="foreman"))?"linemanRate":"investorRate"]:0}};});
 g.changeLog=[...(g.changeLog||[]),`Added code ${newCode.code}`];
 g.version=(g.version||1)+1;g.uploadedAt=new Date().toISOString();nc[sel]=g;setRateCards(nc);
 setShowAddCode(false);setNewCode({code:"",description:"",mapsTo:"",unit:"per foot"});
 };

 const deleteCode=(code)=>{
 if(!sel)return;const nc={...rateCards};const g={...nc[sel]};
 g.codes=g.codes.filter(c=>c.code!==code);
 Object.keys(g.profiles).forEach(pn=>{const p={...g.profiles[pn]};delete p[code];g.profiles[pn]=p;});
 g.changeLog=[...(g.changeLog||[]),`Deleted code ${code}`];
 g.version=(g.version||1)+1;g.uploadedAt=new Date().toISOString();nc[sel]=g;setRateCards(nc);
 };

 const[openClients,setOpenClients]=useState({});
 const[openCustomers,setOpenCustomers]=useState({});

 const tree=useMemo(()=>{
 const t={};
 groups.forEach(g=>{
 if(!t[g.client])t[g.client]={};
 if(!t[g.client][g.customer])t[g.client][g.customer]=[];
 t[g.client][g.customer].push(g);
 });
 return t;
 },[groups]);

 const togClient=(c)=>setOpenClients(p=>({...p,[c]:!p[c]}));
 const togCustomer=(k)=>setOpenCustomers(p=>({...p,[k]:!p[k]}));

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
 <div><h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Rate Cards</h1><p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{groups.length} rate card groups</p></div>
 <div style={{display:"flex",gap:8}}>
 <Btn v="ghost" onClick={()=>setImpM(true)}>Import Excel</Btn>
 <Btn onClick={()=>setShowCreate(true)}>+ New Rate Card</Btn>
 </div>
 </div>

 {!sel?<div>
 {Object.entries(tree).map(([client,customers])=>{
 const clientOpen=openClients[client]===true;
 const clientGroups=Object.values(customers).flat();
 const totalCodes=clientGroups.reduce((s,g)=>s+g.codes.length,0);
 return <Card key={client} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
 <div onClick={()=>togClient(client)} style={{padding:"14px 20px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bgCard}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <span style={{fontSize:14,color:T.textMuted,fontWeight:700,transition:"transform 0.2s",transform:clientOpen?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
 <div>
 <div style={{fontSize:15,fontWeight:700,color:T.text}}>{client}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{Object.keys(customers).length} customer{Object.keys(customers).length!==1?"s":""} · {totalCodes} codes</div>
 </div>
 </div>
 <Badge label="Client" color={T.accent} bg={T.accentSoft}/>
 </div>
 {clientOpen&&<div style={{padding:"0 12px 12px"}}>
 {Object.entries(customers).map(([customer,regions])=>{
 const custKey=`${client}|${customer}`;
 const custOpen=openCustomers[custKey]===true;
 return <div key={customer} style={{marginTop:8}}>
 <div onClick={()=>togCustomer(custKey)} style={{padding:"10px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bgInput,borderRadius:4,border:`1px solid ${T.border}`}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{fontSize:12,color:T.textMuted,fontWeight:700,transition:"transform 0.2s",transform:custOpen?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
 <div>
 <div style={{fontSize:13,fontWeight:700,color:T.text}}>{customer}</div>
 <div style={{fontSize:10,color:T.textMuted}}>{regions.length} region{regions.length!==1?"s":""}</div>
 </div>
 </div>
 <Badge label="Customer" color={T.purple} bg={T.purpleSoft}/>
 </div>
 {custOpen&&<div style={{paddingLeft:24,marginTop:6,display:"flex",flexDirection:"column",gap:6}}>
 {regions.map(g=><div key={g.id} onClick={()=>setSel(g.id)} className="card-hover" style={{padding:"10px 14px",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:4,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{g.region}</div>
 <div style={{fontSize:10,color:T.textDim}}>{g.codes.length} codes · {Object.keys(g.profiles).length} profiles · v{g.version}</div>
 </div>
 </div>
 <div style={{fontSize:10,color:T.textDim}}>Updated {fd(g.uploadedAt)}</div>
 </div>)}
 </div>}
 </div>;
 })}
 </div>}
 </Card>;
 })}
 </div>
 :<div>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <Btn v="ghost" sz="sm" onClick={()=>{setSel(null);setProf("NextGen Default")}}>← Back</Btn>
 <div><h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{grp.customer} — {grp.region}</h2><span style={{fontSize:12,color:T.textMuted}}>Client: {grp.client} · v{grp.version} · {profNames.length} profiles</span></div>
 </div>
 <Btn sz="sm" onClick={()=>setShowAddCode(true)}>+ Add Code</Btn>
 </div>

 <Card style={{marginBottom:16,padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Select Profile</div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 {profNames.map(pn=>{const isNG=pn==="NextGen Default";const isLM=USERS.some(u=>u.name===pn&&(u.role==="lineman"||u.role==="foreman"));const clr=isNG?T.success:isLM?T.accent:T.purple;
 return <button key={pn} onClick={()=>setProf(pn)} style={{padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:600,border:`1px solid ${prof===pn?clr:T.border}`,background:prof===pn?clr+"22":"transparent",color:prof===pn?clr:T.textMuted,cursor:"pointer",transition:"all 0.15s"}}>
 {pn}
 </button>;
 })}
 </div>
 </Card>

 <DT columns={[
 {key:"code",label:"Code",render:r=><div style={{display:"flex",alignItems:"center",gap:4}}>
 <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:T.accent}}>{r.code}</span>
 <button onClick={e=>{e.stopPropagation();setEditM({gk:sel,code:r.code,field:"code",isCodeField:true});setEditV(r.code);}} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:12,padding:"2px 4px",opacity:0.8,borderRadius:3}}>✎</button>
 </div>},
 {key:"description",label:"Description",render:r=><div style={{display:"flex",alignItems:"center",gap:4}}>
 <span style={{fontSize:12}}>{r.description||<span style={{color:T.textDim,fontStyle:"italic"}}>No description</span>}</span>
 <button onClick={e=>{e.stopPropagation();setEditM({gk:sel,code:r.code,field:"description",isCodeField:true});setEditV(r.description||"");}} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:12,padding:"2px 4px",opacity:0.8,borderRadius:3}}>✎</button>
 </div>},
 {key:"mapsTo",label:"Maps To",render:r=><div style={{display:"flex",alignItems:"center",gap:4}}>
 {r.mapsTo&&r.mapsTo!=="—"?<Badge label={r.mapsTo} color={T.cyan} bg={T.cyanSoft}/>
 :<span style={{fontSize:11,color:T.danger}}>Not mapped</span>}
 <button onClick={e=>{e.stopPropagation();setEditM({gk:sel,code:r.code,field:"mapsTo",isCodeField:true});setEditV(r.mapsTo||"");}} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:12,padding:"2px 4px",opacity:0.8,borderRadius:3}}>✎</button>
 </div>},
 {key:"unit",label:"Unit",render:r=><div style={{display:"flex",alignItems:"center",gap:4}}>
 <span style={{fontSize:11,color:T.textMuted}}>{r.unit}</span>
 <button onClick={e=>{e.stopPropagation();setEditM({gk:sel,code:r.code,field:"unit",isCodeField:true});setEditV(r.unit||"per foot");}} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:12,padding:"2px 4px",opacity:0.8,borderRadius:3}}>✎</button>
 </div>},
 {key:"rate",label:rateLabel,
 render:r=>{const v=grp.profiles[prof]?.[r.code]?.[rField];return v!=null?<span style={{fontWeight:700,color:profType==="nextgen"?T.success:profType==="lineman"?T.accent:T.purple}}>{r.unit==="per foot"?`$${v.toFixed(2)}/ft`:`$${v.toFixed(2)}/ea`}</span>:<span style={{color:T.danger,fontWeight:600}}>NOT SET</span>;}},
 {key:"a",label:"",render:r=><div style={{display:"flex",gap:4}}>
 <Btn v="ghost" sz="sm" onClick={e=>{e.stopPropagation();setEditM({gk:sel,code:r.code,pn:prof,field:rField,isCodeField:false});setEditV(grp.profiles[prof]?.[r.code]?.[rField]?.toString()||"");}}>Edit Rate</Btn>
 <button onClick={e=>{e.stopPropagation();if(confirm(`Delete code ${r.code}?`))deleteCode(r.code);}} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:12,padding:"2px 6px",opacity:0.5}} title="Delete code">✕</button>
 </div>},
 ]} data={grp.codes}/>

 {grp.codes.length===0&&<Card style={{textAlign:"center",padding:40}}>
 <div style={{fontSize:13,color:T.textMuted,marginBottom:8}}>No codes yet</div>
 <Btn sz="sm" onClick={()=>setShowAddCode(true)}>+ Add Your First Code</Btn>
 </Card>}

 <Card style={{marginTop:16}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:10}}>Change Log</h3>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:8}}>Uploaded by: {grp.uploadedBy} · Last: {fdt(grp.uploadedAt)}</div>
 {(grp.changeLog||[]).slice(-10).reverse().map((l,i)=><div key={i} style={{fontSize:12,color:T.textDim,padding:"4px 0",borderBottom:`1px solid ${T.border}`}}>• {l}</div>)}
 </Card>
 </div>}

 {/* Edit field modal */}
 <Modal open={!!editM} onClose={()=>setEditM(null)} title={editM?.field==="description"?"Edit Description":editM?.field==="mapsTo"?"Edit Work Type Mapping":editM?.field==="code"?"Edit Code":editM?.field==="unit"?"Edit Unit":"Edit Rate"} width={400}>
 {editM&&<div>
 <p style={{fontSize:13,color:T.textMuted,marginBottom:12}}>Code: <b style={{color:T.accent}}>{editM.code}</b>{editM.pn?<> · Profile: <b>{editM.pn}</b></>:null}</p>
 {editM.field==="mapsTo"?<>
 <Inp label="Maps to work type" value={editV} onChange={setEditV} options={allMapsTo}/>
 <div style={{fontSize:11,color:T.textDim,marginBottom:12}}>Links the client billing code to the work type your crews use. The calc engine uses this to match production to the right rate.</div>
 </>:editM.field==="description"?
 <Inp label="Description" value={editV} onChange={setEditV} ph="e.g. Strand, Overlash, Directional Boring..."/>
 :editM.field==="code"?
 <Inp label="Code" value={editV} onChange={setEditV} ph="e.g. BSPDLASH"/>
 :editM.field==="unit"?
 <Inp label="Unit" value={editV} onChange={setEditV} options={["per foot","per each"]}/>
 :<Inp label={rateLabel} type="number" value={editV} onChange={setEditV} ph="0.00"/>}
 <div style={{display:"flex",justifyContent:"flex-end",gap:10}}><Btn v="ghost" onClick={()=>setEditM(null)}>Cancel</Btn><Btn onClick={handleSave}>Save</Btn></div>
 </div>}
 </Modal>

 {/* Create new rate card modal */}
 <Modal open={showCreate} onClose={()=>setShowCreate(false)} title="Create New Rate Card" width={440}>
 <div>
 <Inp label="Client" value={newRC.client} onChange={v=>setNewRC(p=>({...p,client:v}))} ph="e.g. MasTec, Quanta, Dycom..."/>
 <Inp label="Customer" value={newRC.customer} onChange={v=>setNewRC(p=>({...p,customer:v}))} ph="e.g. Brightspeed, AT&T, Spectrum..."/>
 <Inp label="Region" value={newRC.region} onChange={v=>setNewRC(p=>({...p,region:v}))} ph="e.g. Alabama, North Carolina..."/>
 {newRC.client&&newRC.customer&&newRC.region&&rateCards[`${newRC.client}|${newRC.customer}|${newRC.region}`]&&<div style={{fontSize:11,color:T.danger,marginBottom:8}}>A rate card already exists for this combination.</div>}
 <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:8}}><Btn v="ghost" onClick={()=>setShowCreate(false)}>Cancel</Btn><Btn onClick={createRateCard} disabled={!newRC.client.trim()||!newRC.customer.trim()||!newRC.region.trim()||!!rateCards[`${newRC.client}|${newRC.customer}|${newRC.region}`]}>Create</Btn></div>
 </div>
 </Modal>

 {/* Add code modal */}
 <Modal open={showAddCode} onClose={()=>setShowAddCode(false)} title="Add Billing Code" width={440}>
 <div>
 <Inp label="Code" value={newCode.code} onChange={v=>setNewCode(p=>({...p,code:v.toUpperCase()}))} ph="e.g. BSPDLASH"/>
 <Inp label="Description" value={newCode.description} onChange={v=>setNewCode(p=>({...p,description:v}))} ph="e.g. Overlash, Directional Boring..."/>
 <Inp label="Maps To" value={newCode.mapsTo} onChange={v=>setNewCode(p=>({...p,mapsTo:v}))} options={allMapsTo}/>
 <Inp label="Unit" value={newCode.unit} onChange={v=>setNewCode(p=>({...p,unit:v}))} options={["per foot","per each"]}/>
 {grp&&newCode.code&&grp.codes.some(c=>c.code===newCode.code)&&<div style={{fontSize:11,color:T.danger,marginBottom:8}}>This code already exists.</div>}
 <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:8}}><Btn v="ghost" onClick={()=>setShowAddCode(false)}>Cancel</Btn><Btn onClick={addCode} disabled={!newCode.code.trim()}>Add Code</Btn></div>
 </div>
 </Modal>

 {/* Import modal */}
 <Modal open={impM} onClose={()=>setImpM(false)} title="Import Rate Card from Excel" width={500}>
 {(()=>{const[impTarget,setImpTarget]=useState("");const[impProfile,setImpProfile]=useState("");
 return <div>
 <div onClick={()=>{/* File input simulation */const nc={...rateCards};const gk=impTarget||Object.keys(nc)[0];if(!gk||!nc[gk])return;const g={...nc[gk]};g.changeLog=[...(g.changeLog||[]),`Imported rates from Excel for profile "${impProfile||"NextGen Default"}"`];g.version=(g.version||1)+1;g.uploadedAt=new Date().toISOString();nc[gk]=g;setRateCards(nc);setImpM(false);}} style={{padding:32,border:`2px dashed ${T.border}`,borderRadius:4,textAlign:"center",marginBottom:16,cursor:"pointer",transition:"border-color 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
 <div style={{fontSize:36,marginBottom:8}}>📄</div>
 <div style={{fontSize:14,fontWeight:600,color:T.text}}>Drop Excel file or click to browse</div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:6}}>Columns: Code, Description, Unit, Rate</div>
 </div>
 <Inp label="Target Rate Card" value={impTarget} onChange={setImpTarget} options={groups.map(g=>g.id)}/>
 <Inp label="Apply to Profile" value={impProfile} onChange={setImpProfile} options={impTarget&&rateCards[impTarget]?Object.keys(rateCards[impTarget].profiles):[]}/>
 <div style={{display:"flex",justifyContent:"flex-end",gap:10}}><Btn v="ghost" onClick={()=>setImpM(false)}>Cancel</Btn><Btn onClick={()=>{if(!impTarget)return;const nc={...rateCards};const g={...nc[impTarget]};g.changeLog=[...(g.changeLog||[]),`Imported rates from Excel for profile "${impProfile||"NextGen Default"}"`];g.version=(g.version||1)+1;g.uploadedAt=new Date().toISOString();nc[impTarget]=g;setRateCards(nc);setImpM(false);}}>Import</Btn></div>
 </div>;})()}
 </Modal>
 </div>;
}

// ─── JOBS MANAGEMENT ─────────────────────────────────────────────────────────
function JobsMgmt(){
 const{jobs,setJobs,rateCards,currentUser,setView,setSelectedJob,trucks,drills,jobsPreFilter,setJobsPreFilter,isMobile:_m}=useApp();
 const[fl,setFl]=useState({status:jobsPreFilter||( currentUser.role==="billing"?"Ready to Invoice":""),customer:"",search:"",fin:""});
 const[showC,setShowC]=useState(false);
 const[expandedJobId,setExpandedJobId]=useState(null);
 const[nj,setNj]=useState({department:"aerial",client:"MasTec",customer:"",region:"",location:"",olt:"",feederId:"",supervisorNotes:"",assignedLineman:"",assignedTruck:"",assignedDrill:""});
 const lms=USERS.filter(u=>u.role==="lineman");
 const fms=USERS.filter(u=>u.role==="foreman");
 const isAdm=["admin","supervisor","billing"].includes(currentUser.role);

 const filtered=useMemo(()=>{
 let f=[...jobs];
 if(currentUser.role==="lineman"||currentUser.role==="foreman")f=f.filter(j=>j.assignedLineman===currentUser.id);
 if(currentUser.role==="client_manager"&&currentUser.scope)f=f.filter(j=>j.client===currentUser.scope.client);
 if(currentUser.role==="truck_investor"){const myTrucks=currentUser.trucks||[];f=f.filter(j=>myTrucks.includes(j.assignedTruck));}
 if(currentUser.role==="drill_investor"){const myDrills=currentUser.drills||[];f=f.filter(j=>myDrills.includes(j.assignedDrill));}
 if(currentUser.role==="redline_specialist")f=f.filter(j=>j.production!=null&&["Pending Redlines","Under Client Review","Rejected"].includes(j.status));
 if(fl.status)f=f.filter(j=>j.status===fl.status);
 if(fl.customer)f=f.filter(j=>j.customer===fl.customer);
 if(fl.search){const s=fl.search.toLowerCase();f=f.filter(j=>j.id.toLowerCase().includes(s)||j.feederId.toLowerCase().includes(s)||j.olt.toLowerCase().includes(s)||j.location.toLowerCase().includes(s));}
 if(fl.fin)f=f.filter(j=>calcJob(j,rateCards).status===fl.fin);
 return f;
 },[jobs,fl,currentUser,rateCards]);

 const handleC=()=>{
 const isUG=nj.department==="underground";
 const maxId=Math.max(...jobs.map(j=>parseInt(j.id)||0),0);
 const newId=String(maxId+1).padStart(4,"0");
 if(isUG){
 const drill=drills.find(d=>d.id===nj.assignedDrill);
 const job={...nj,id:newId,workType:"Underground Boring",estimatedFootage:0,
 assignedLineman:nj.assignedLineman||null,assignedDrill:nj.assignedDrill||null,
 drillInvestor:drill?.investorName||null,assignedTruck:null,truckInvestor:null,
 status:nj.assignedLineman?"Assigned":"Unassigned",
 redlineStatus:"Not Uploaded",srNumber:null,production:null,confirmedTotals:null,billedAt:null,redlines:[],reviewNotes:"",messages:[],
 mapPdf:nj.mapPdf||null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 setJobs([job,...jobs]);
 } else {
 const truck=trucks.find(t=>t.id===nj.assignedTruck);
 const job={...nj,id:newId,workType:"",estimatedFootage:0,
 assignedLineman:nj.assignedLineman||null,assignedTruck:nj.assignedTruck||null,
 truckInvestor:truck?truck.owner:null,assignedDrill:null,drillInvestor:null,
 status:nj.assignedLineman?"Assigned":"Unassigned",
 redlineStatus:"Not Uploaded",srNumber:null,production:null,confirmedTotals:null,billedAt:null,redlines:[],reviewNotes:"",messages:[],
 mapPdf:nj.mapPdf||null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 setJobs([job,...jobs]);
 }
 setShowC(false);
 setNj({department:"aerial",client:"MasTec",customer:"",region:"",location:"",olt:"",feederId:"",supervisorNotes:"",assignedLineman:"",assignedTruck:"",assignedDrill:""});
 };

 const isLM=currentUser.role==="lineman"||currentUser.role==="foreman";
 const isRS=currentUser.role==="redline_specialist";

 // Lineman earnings helper - returns pay for a single job
 const lmEarnings=(r)=>{const f=calcJob(r,rateCards);return f.status==="Calculated"&&f.totals?f.totals.linemanPay:null;};

 // Lineman: current week earnings only
 const lmWeekEarnings=useMemo(()=>{
 if(!isLM)return{total:0,jobs:0,pending:0};
 const thisWeek=payWeekKey(new Date());
 let total=0,jobCount=0,pending=0;
 filtered.forEach(r=>{
 if(r.production?.completedDate&&payWeekKey(new Date(r.production.completedDate))===thisWeek){
 const e=lmEarnings(r);if(e)total+=e;jobCount++;
 }
 if(!r.production)pending++;
 });
 return{total,jobs:jobCount,pending};
 },[filtered,isLM]);

 // Foreman: weekly footage toward $300 bonus at 4000ft
 const isFM=currentUser.role==="foreman";
 const fmWeekFootage=useMemo(()=>{
 if(!isFM)return{totalFeet:0,jobs:0,pending:0,bonusHit:false,earnings:0};
 const thisWeek=payWeekKey(new Date());
 let totalFeet=0,jobCount=0,pending=0,earnings=0;
 filtered.forEach(r=>{
 if(r.production?.completedDate&&payWeekKey(new Date(r.production.completedDate))===thisWeek){
 const days=r.production?.days||[];
 days.forEach(d=>{totalFeet+=(d.conduitFeet||0);});
 const e=lmEarnings(r);if(e)earnings+=e;jobCount++;
 }
 if(!r.production)pending++;
 });
 return{totalFeet,jobs:jobCount,pending,bonusHit:totalFeet>=4000,earnings};
 },[filtered,isFM]);
 const bonusTarget=4000;
 const fmBonusPct=Math.min((fmWeekFootage.totalFeet/bonusTarget)*100,100);
 const fmFeetLeft=Math.max(bonusTarget-fmWeekFootage.totalFeet,0);

 // Supervisor: weekly region production & commission tracking
 const isSV=currentUser.role==="supervisor";
 const svScope=currentUser.scope||{};
 const svCommRate=currentUser.commissionRate||0.03;
 const svSalary=currentUser.weeklySalary||1500;
 const svWeekData=useMemo(()=>{
 if(!isSV)return{totalRev:0,commission:0,totalPay:0,totalFeet:0,jobs:0,regionJobs:0};
 const thisWeek=payWeekKey(new Date());
 let totalRev=0,totalFeet=0,jobsDone=0,regionJobs=0;
 jobs.filter(j=>j.customer===svScope.customer&&j.region===svScope.region).forEach(j=>{
 regionJobs++;
 if(j.production?.completedDate&&payWeekKey(new Date(j.production.completedDate))===thisWeek){
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){totalRev+=f.totals.nextgenRevenue;totalFeet+=j.production?.totalFeet||0;jobsDone++;}
 }
 });
 const commission=+(totalRev*svCommRate).toFixed(2);
 return{totalRev,commission,totalPay:+(svSalary+commission).toFixed(2),totalFeet,jobs:jobsDone,regionJobs};
 },[jobs,rateCards,isSV,svScope,svCommRate,svSalary]);
 const svWeeklyGoal=75000;// ft weekly target for their region
 const svGoalPct=Math.min((svWeekData.totalFeet/svWeeklyGoal)*100,100);

 // Progress bar milestones
 const milestones=[1000,2000,3000,4000,5000,7500,10000];
 const nextMilestone=milestones.find(m=>m>lmWeekEarnings.total)||milestones[milestones.length-1];
 const prevMilestone=milestones.filter(m=>m<=lmWeekEarnings.total).pop()||0;
 const progressMax=nextMilestone;
 const progressPct=Math.min((lmWeekEarnings.total/progressMax)*100,100);
 // Day of week progress (Mon=1, Sun=7)
 // Simulate Thursday for preview
 const dayNum=4;
 const daysLeft=7-dayNum;

 // Redline specialist tab filter — uses same statuses as admin
 const[rsTab,setRsTab]=useState(isRS?"Pending Redlines":"all");
 const rsFiltered=useMemo(()=>{
 if(!isRS)return filtered;
 if(rsTab==="all")return filtered;
 return filtered.filter(j=>j.status===rsTab);
 },[filtered,rsTab,isRS]);

 const rsCounts=useMemo(()=>{
 if(!isRS)return{};
 const c={all:filtered.length};
 Object.keys(STATUS_CFG).forEach(s=>{c[s]=0;});
 filtered.forEach(j=>{c[j.status]=(c[j.status]||0)+1;});
 return c;
 },[filtered,isRS]);

 const displayData=isRS?rsFiltered:filtered;

 // Sorting
 const[sortKey,setSortKey]=useState("date");const[sortDir,setSortDir]=useState("desc");
 const getCompDate=(r)=>r.production?.completedDate||"";
 const getRevenue=(r)=>{const f=calcJob(r,rateCards);return f.status==="Calculated"&&f.totals?f.totals.nextgenRevenue:0;};
 const sorted=useMemo(()=>{
 const d=[...displayData];
 d.sort((a,b)=>{
 // Lineman: unsubmitted jobs always float to top
 if(isLM){
 const aProd=!!a.production, bProd=!!b.production;
 if(!aProd&&bProd)return -1;
 if(aProd&&!bProd)return 1;
 }
 // Date sort: jobs without completed date always go to bottom
 if(sortKey==="date"&&!isLM){
 const aHas=!!a.production?.completedDate, bHas=!!b.production?.completedDate;
 if(aHas&&!bHas)return -1;
 if(!aHas&&bHas)return 1;
 if(!aHas&&!bHas)return 0;
 }
 let av,bv;
 if(sortKey==="date"){av=getCompDate(a);bv=getCompDate(b);}
 else if(sortKey==="revenue"){av=getRevenue(a);bv=getRevenue(b);}
 else if(sortKey==="status"){av=a.status;bv=b.status;}
 else if(sortKey==="customer"){av=a.customer;bv=b.customer;}
 else if(sortKey==="id"){av=a.id;bv=b.id;}
 else{av=a[sortKey]||"";bv=b[sortKey]||"";}
 if(av<bv)return sortDir==="asc"?-1:1;
 if(av>bv)return sortDir==="asc"?1:-1;
 return 0;
 });
 return d;
 },[displayData,sortKey,sortDir,rateCards,isLM]);
 const toggleSort=(k)=>{if(sortKey===k)setSortDir(sortDir==="asc"?"desc":"asc");else{setSortKey(k);setSortDir(k==="date"?"desc":"asc");}};
 const SI=({k})=><span style={{marginLeft:4,fontSize:9,color:sortKey===k?T.accent:T.textDim}}>{sortKey===k?(sortDir==="asc"?"▲":"▼"):"⇅"}</span>;

 const cols=isLM?[
 {key:"id",label:"Job ID",render:r=><span style={{fontWeight:700,color:T.accent,fontFamily:"monospace",fontSize:12}}>{r.id}</span>},
 {key:"customer",label:"Customer"},
 {key:"location",label:"Location"},
 {key:"olt",label:"OLT",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.olt}</span>},
 {key:"feederId",label:"Feeder/Run",render:r=><span style={{fontWeight:600}}>{r.feederId}</span>},
 {key:"compDate",label:"Completed",render:r=>{const d=r.production?.completedDate;
 return d?<span style={{fontSize:12}}>{fd(d)}</span>:<span style={{color:T.textDim,fontSize:11}}>—</span>;}},
 {key:"prod",label:"Production",render:r=>r.production
 ?<Badge label={`${r.production.totalFeet} ft`} color={T.success} bg={T.successSoft}/>
 :<Badge label="Needs Submission" color={T.warning} bg={T.warningSoft}/>},
 {key:"earnings",label:"My Earnings",render:r=>{const e=lmEarnings(r);
 return e!=null?<span style={{fontSize:14,fontWeight:600,color:T.success}}>{$(e)}</span>
 :r.production?<span style={{fontSize:12,color:T.textDim}}>Calculating...</span>
 :<span style={{fontSize:12,color:T.textMuted}}>Submit to see</span>;}},
 ]:isRS?[
 {key:"id",label:"Job ID",render:r=><span style={{fontWeight:700,color:T.accent,fontFamily:"monospace",fontSize:12}}>{r.id}</span>},
 {key:"customer",label:"Customer"},
 {key:"location",label:"Location"},
 {key:"olt",label:"OLT",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.olt}</span>},
 {key:"feederId",label:"Feeder/Run",render:r=><span style={{fontWeight:600}}>{r.feederId}</span>},
 {key:"compDate",label:"Completed",render:r=>{const d=r.production?.completedDate;
 return d?<span style={{fontSize:12}}>{fd(d)}</span>:<span style={{color:T.textDim,fontSize:11}}>—</span>;}},
 {key:"status",label:"Status",render:r=><SB status={r.status}/>},
 {key:"lm",label:"Lineman",render:r=>{const u=USERS.find(u=>u.id===r.assignedLineman);return u?<span style={{fontSize:12}}>{u.name}</span>:<span style={{color:T.textDim,fontSize:12}}>—</span>;}},
 {key:"feet",label:"Footage",render:r=>r.production?<span style={{fontWeight:600}}>{r.production.totalFeet} ft</span>:<span style={{color:T.textDim}}>—</span>},
 ]:[
 {key:"id",label:"Job ID",sort:"id",render:r=><span style={{fontWeight:700,color:T.accent,fontFamily:"monospace",fontSize:12}}>{r.id}</span>},
 {key:"customer",label:"Customer",sort:"customer"},
 {key:"location",label:"Location"},
 {key:"olt",label:"OLT",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.olt}</span>},
 {key:"feederId",label:"Feeder/Run",render:r=><span style={{fontWeight:600}}>{r.feederId}</span>},
 {key:"compDate",label:<span style={{cursor:"pointer"}} onClick={()=>toggleSort("date")}>Completed<SI k="date"/></span>,
 render:r=>{const d=r.production?.completedDate;return d?<span style={{fontSize:12}}>{fd(d)}</span>:<span style={{color:T.textDim,fontSize:11}}>—</span>;}},
 {key:"status",label:"Status",sort:"status",render:r=><SB status={r.status}/>},
 {key:"lm",label:"Lineman",render:r=>{const u=USERS.find(u=>u.id===r.assignedLineman);return u?<span style={{fontSize:12}}>{u.name}</span>:<span style={{color:T.textDim,fontSize:12}}>—</span>;}},
 ...(currentUser.role==="admin"?[{key:"fin",label:<span style={{cursor:"pointer"}} onClick={()=>toggleSort("revenue")}>Revenue<SI k="revenue"/></span>,
 render:r=>{const f=calcJob(r,rateCards);return f.status==="Calculated"&&f.totals
 ?<span style={{fontWeight:700,fontSize:13,color:T.success}}>{$(f.totals.nextgenRevenue)}</span>
 :f.status==="No Production"?<span style={{color:T.textDim,fontSize:11}}>—</span>
 :<span style={{color:T.danger,fontSize:11}}>{f.status}</span>;}}]:[]),
 {key:"sr",label:"SR #",render:r=>r.srNumber?<span style={{fontFamily:"monospace",fontSize:11,color:T.success}}>{r.srNumber}</span>:<span style={{color:T.textDim}}>—</span>},
 ];

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:_m?12:20,gap:8,flexWrap:"wrap"}}>
 <div>
 <h1 style={{fontSize:_m?16:18,fontWeight:600,margin:0,color:T.text}}>
 {isLM?"My Jobs":isRS?"Redline Queue":currentUser.role==="client_manager"?"Jobs — Review Queue":"Jobs Management"}
 </h1>
 <p style={{color:T.textMuted,fontSize:_m?11:13,margin:"4px 0 0"}}>{displayData.length} job{displayData.length!==1?"s":""}{isRS&&rsTab!=="all"?` · filtered by "${rsTab}"`:""}</p>
 </div>
 {["admin","supervisor"].includes(currentUser.role)&&<Btn onClick={()=>setShowC(true)}>+ New Job</Btn>}
 </div>

 {/* Redline specialist queue tabs */}
 {isRS&&<div style={{display:"flex",gap:_m?4:6,marginBottom:_m?10:16,flexWrap:"wrap"}}>
 {[{k:"all",l:"All"},{k:"Pending Redlines",l:_m?"Pending":"Pending Redlines"},{k:"Under Client Review",l:_m?"Review":"Under Review"},{k:"Rejected",l:"Rejected"}].map(t=>{
 const sc=STATUS_CFG[t.k]||{c:T.text,bg:"transparent"};const active=rsTab===t.k;const count=rsCounts[t.k]||0;
 return <button key={t.k} onClick={()=>setRsTab(t.k)} style={{
 display:"flex",alignItems:"center",gap:_m?4:6,padding:_m?"6px 10px":"7px 14px",borderRadius:4,border:`1px solid ${active?sc.c||T.text:T.border}`,
 background:active?(sc.c||T.text)+"18":"transparent",color:active?sc.c||T.text:T.textMuted,fontSize:_m?11:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s",
 }}>
 {t.l}
 <span style={{background:active?(sc.c||T.text)+"33":T.bgInput,padding:"1px 7px",borderRadius:4,fontSize:10,fontWeight:700,color:active?sc.c||T.text:T.textDim}}>{count}</span>
 </button>;
 })}
 </div>}

 {/* Lineman weekly earnings tracker */}
 {isLM&&!isFM&&<Card style={{marginBottom:_m?12:18,padding:0,overflow:"hidden",borderColor:T.accent+"44"}}>
 {/* Top section: This week's earnings */}
 <div style={{padding:_m?"14px 14px 10px":"18px 20px 14px",background:T.bgCard}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:_m?10:14,gap:8}}>
 <div>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>This Week's Earnings</div>
 <div style={{fontSize:_m?28:36,fontWeight:600,color:T.success,lineHeight:1.1,marginTop:4}}>{$(lmWeekEarnings.total)}</div>
 </div>
 <div style={{textAlign:"right",flexShrink:0}}>
 <div style={{fontSize:_m?10:11,color:T.textMuted}}>{daysLeft>0?`${daysLeft} day${daysLeft>1?"s":""} left`:"Week ends today!"}</div>
 <div style={{display:"flex",gap:_m?2:3,marginTop:6,justifyContent:"flex-end"}}>
 {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} style={{
 width:_m?18:22,height:_m?18:22,borderRadius:_m?4:5,fontSize:_m?8:9,fontWeight:700,
 display:"flex",alignItems:"center",justifyContent:"center",
 background:i===dayNum-1?T.success:i<dayNum-1?"rgba(34,197,94,0.25)":T.bgInput,
 color:i===dayNum-1?"#fff":i<dayNum-1?T.success:T.textDim,
 border:`1px solid ${i===dayNum-1?T.success:i<dayNum-1?"rgba(34,197,94,0.35)":T.border}`,
 }}>{d}</div>)}
 </div>
 </div>
 </div>

 {/* Progress bar */}
 <div style={{position:"relative",marginBottom:6}}>
 <div style={{height:20,borderRadius:4,background:T.bgInput,overflow:"hidden",position:"relative"}}>
 <div style={{
 height:"100%",borderRadius:4,
 background:T.accent,
 width:`${progressPct}%`,transition:"width 0.6s ease",
 
 }}/>
 </div>
 {/* Milestone markers */}
 <div style={{position:"relative",height:16,marginTop:2}}>
 {milestones.filter(m=>m<=progressMax*1.2).map(m=>{
 const pos=Math.min((m/progressMax)*100,100);
 const hit=lmWeekEarnings.total>=m;
 return <div key={m} style={{position:"absolute",left:`${pos}%`,transform:"translateX(-50%)",fontSize:9,fontWeight:700,color:hit?T.success:T.textDim}}>
 {m>=1000?`$${m/1000}k`:`$${m}`}
 </div>;
 })}
 </div>
 </div>
 </div>

 {/* Bottom stats row */}
 <div style={{display:"flex",borderTop:`1px solid ${T.border}`}}>
 <div style={{flex:1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:`1px solid ${T.border}`}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.text}}>{lmWeekEarnings.jobs}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Jobs Done</div>
 </div>
 <div style={{flex:1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:`1px solid ${T.border}`}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.warning}}>{lmWeekEarnings.pending}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Ready to Work</div>
 </div>
 <div style={{flex:1,padding:_m?"8px 8px":"10px 16px",textAlign:"center"}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.accent}}>{$(nextMilestone-lmWeekEarnings.total)}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>To Next Goal</div>
 </div>
 </div>

 {lmWeekEarnings.pending>0&&<div style={{padding:_m?"6px 12px":"8px 16px",background:T.warningSoft,fontSize:_m?11:12,color:T.warning,fontWeight:600,textAlign:"center"}}>
 {lmWeekEarnings.pending} job{lmWeekEarnings.pending>1?"s":""} assigned — submit production to increase weekly total.
 </div>}
 </Card>}

 {/* Foreman weekly footage bonus tracker */}
 {isFM&&<Card style={{marginBottom:_m?12:18,padding:0,overflow:"hidden",borderColor:fmWeekFootage.bonusHit?T.success+"66":T.cyan+"44"}}>
 <div style={{padding:_m?"14px 14px 10px":"18px 20px 14px",background:T.bgCard}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:_m?10:14,gap:8}}>
 <div>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Weekly Bonus Tracker</div>
 <div style={{fontSize:_m?28:36,fontWeight:600,color:fmWeekFootage.bonusHit?T.success:T.cyan,lineHeight:1.1,marginTop:4}}>
 {fmWeekFootage.totalFeet.toLocaleString()} <span style={{fontSize:_m?12:16,fontWeight:600}}>ft</span>
 </div>
 {fmWeekFootage.bonusHit
 ?<div style={{fontSize:_m?11:12,fontWeight:700,color:T.success,marginTop:4,display:"flex",alignItems:"center",gap:4}}>Bonus Achieved — +$300!</div>
 :<div style={{fontSize:_m?11:12,color:T.textMuted,marginTop:4}}>{fmFeetLeft.toLocaleString()} ft to go for <span style={{fontWeight:700,color:T.success}}>$300 bonus</span></div>
 }
 </div>
 <div style={{textAlign:"right",flexShrink:0}}>
 <div style={{fontSize:_m?10:11,color:T.textMuted}}>{daysLeft>0?`${daysLeft} day${daysLeft>1?"s":""} left`:"Week ends today!"}</div>
 <div style={{display:"flex",gap:_m?2:3,marginTop:6,justifyContent:"flex-end"}}>
 {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} style={{
 width:_m?18:22,height:_m?18:22,borderRadius:_m?4:5,fontSize:_m?8:9,fontWeight:700,
 display:"flex",alignItems:"center",justifyContent:"center",
 background:i===dayNum-1?T.success:i<dayNum-1?"rgba(34,197,94,0.25)":T.bgInput,
 color:i===dayNum-1?"#fff":i<dayNum-1?T.success:T.textDim,
 border:`1px solid ${i===dayNum-1?T.success:i<dayNum-1?"rgba(34,197,94,0.35)":T.border}`,
 }}>{d}</div>)}
 </div>
 </div>
 </div>

 {/* Footage progress bar toward 4000ft */}
 <div style={{position:"relative",marginBottom:6}}>
 <div style={{height:24,borderRadius:12,background:T.bgInput,overflow:"hidden",position:"relative"}}>
 <div style={{
 height:"100%",borderRadius:12,
 background:fmWeekFootage.bonusHit
 ?T.success
 :T.cyan,
 width:`${fmBonusPct}%`,transition:"width 0.6s ease",
 
 }}/>
 {/* Percentage text inside bar */}
 <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:fmBonusPct>40?"#fff":T.text}}>
 {Math.round(fmBonusPct)}%
 </div>
 </div>
 {/* Footage markers */}
 <div style={{position:"relative",height:16,marginTop:2}}>
 {[1000,2000,3000,4000].map(m=>{
 const pos=(m/bonusTarget)*100;
 const hit=fmWeekFootage.totalFeet>=m;
 return <div key={m} style={{position:"absolute",left:`${pos}%`,transform:"translateX(-50%)",fontSize:9,fontWeight:700,color:hit?(m===4000?T.success:T.cyan):T.textDim}}>
 {m===4000?" 4,000":`${(m/1000).toFixed(0)}k`}
 </div>;
 })}
 </div>
 </div>
 </div>

 {/* Bottom stats row */}
 <div style={{display:"flex",flexWrap:_m?"wrap":"nowrap",borderTop:`1px solid ${T.border}`}}>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:`1px solid ${T.border}`,borderBottom:_m?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.text}}>{fmWeekFootage.jobs}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Jobs Done</div>
 </div>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:_m?"none":`1px solid ${T.border}`,borderBottom:_m?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.warning}}>{fmWeekFootage.pending}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Ready to Bore</div>
 </div>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:`1px solid ${T.border}`}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.success}}>{$(fmWeekFootage.earnings)}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Week Earnings</div>
 </div>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center"}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:fmWeekFootage.bonusHit?T.success:T.cyan}}>{fmWeekFootage.bonusHit?"":"$300"}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>{fmWeekFootage.bonusHit?"Bonus Earned":"Bonus Goal"}</div>
 </div>
 </div>

 {!fmWeekFootage.bonusHit&&fmWeekFootage.pending>0&&<div style={{padding:_m?"6px 12px":"8px 16px",background:T.cyanSoft,fontSize:_m?11:12,color:T.cyan,fontWeight:600,textAlign:"center"}}>
 {fmWeekFootage.pending} job{fmWeekFootage.pending>1?"s":""} assigned — complete {fmFeetLeft.toLocaleString()} additional ft for $300 weekly bonus.
 </div>}
 {fmWeekFootage.bonusHit&&<div style={{padding:"8px 16px",background:T.successSoft,fontSize:12,color:T.success,fontWeight:600,textAlign:"center"}}>
 Exceeding targets. Continue current pace.
 </div>}
 </Card>}

 {/* Supervisor weekly region tracker */}
 {isSV&&<Card style={{marginBottom:_m?12:18,padding:0,overflow:"hidden",borderColor:T.accent+"44"}}>
 <div style={{padding:_m?"14px 14px 10px":"18px 20px 14px",background:T.bgCard}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:_m?10:14,gap:8}}>
 <div>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>This Week — {svScope.customer} · {svScope.region}</div>
 <div style={{fontSize:_m?28:36,fontWeight:600,color:T.success,lineHeight:1.1,marginTop:4}}>{$(svWeekData.commission)}</div>
 <div style={{fontSize:_m?11:12,color:T.textMuted,marginTop:4}}>commission earned this week</div>
 </div>
 <div style={{textAlign:"right",flexShrink:0}}>
 <div style={{fontSize:_m?10:11,color:T.textMuted}}>{daysLeft>0?`${daysLeft} day${daysLeft>1?"s":""} left`:"Week ends today!"}</div>
 <div style={{display:"flex",gap:_m?2:3,marginTop:6,justifyContent:"flex-end"}}>
 {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} style={{
 width:_m?18:22,height:_m?18:22,borderRadius:_m?4:5,fontSize:_m?8:9,fontWeight:700,
 display:"flex",alignItems:"center",justifyContent:"center",
 background:i===dayNum-1?T.success:i<dayNum-1?"rgba(34,197,94,0.25)":T.bgInput,
 color:i===dayNum-1?"#fff":i<dayNum-1?T.success:T.textDim,
 border:`1px solid ${i===dayNum-1?T.success:i<dayNum-1?"rgba(34,197,94,0.35)":T.border}`,
 }}>{d}</div>)}
 </div>
 <div style={{fontSize:_m?16:20,fontWeight:600,color:T.text,marginTop:8}}>{$(svWeekData.totalPay)}</div>
 <div style={{fontSize:10,color:T.textMuted}}>total this week</div>
 </div>
 </div>

 {/* Region footage progress bar */}
 <div style={{position:"relative",marginBottom:6}}>
 <div style={{height:24,borderRadius:12,background:"rgba(59,130,246,0.10)",border:"1px solid rgba(59,130,246,0.08)",overflow:"hidden",position:"relative"}}>
 <div style={{
 height:"100%",borderRadius:12,
 background:svGoalPct>=100?T.success:T.accent,
 width:`${svGoalPct}%`,transition:"width 0.6s ease",
 }}/>
 <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:svGoalPct>40?"#fff":T.text}}>
 {svWeekData.totalFeet.toLocaleString()} ft — {Math.round(svGoalPct)}%
 </div>
 </div>
 <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
 <span style={{fontSize:9,color:T.textDim}}>0 ft</span>
 <span style={{fontSize:9,color:svGoalPct>=100?T.success:T.textDim}}>{(svWeeklyGoal/1000).toFixed(0)}k ft goal</span>
 </div>
 </div>
 </div>

 <div style={{display:"flex",flexWrap:_m?"wrap":"nowrap",borderTop:`1px solid ${T.border}`}}>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:`1px solid ${T.border}`,borderBottom:_m?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.text}}>{svWeekData.jobs}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Jobs Completed</div>
 </div>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:_m?"none":`1px solid ${T.border}`,borderBottom:_m?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.text}}>{svWeekData.totalFeet.toLocaleString()}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Footage</div>
 </div>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center",borderRight:`1px solid ${T.border}`}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.text}}>{svWeekData.regionJobs}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>Region Jobs</div>
 </div>
 <div style={{flex:_m?"1 1 50%":1,padding:_m?"8px 8px":"10px 16px",textAlign:"center"}}>
 <div style={{fontSize:_m?16:18,fontWeight:600,color:T.success}}>{$(svWeekData.commission)}</div>
 <div style={{fontSize:_m?9:10,color:T.textMuted}}>{(svCommRate*100).toFixed(0)}% Commission</div>
 </div>
 </div>

 {svWeekData.totalFeet>0&&svGoalPct<100&&<div style={{padding:"8px 16px",background:T.accentSoft,fontSize:12,color:T.accent,fontWeight:600,textAlign:"center"}}>
 {(svWeeklyGoal-svWeekData.totalFeet).toLocaleString()} ft to weekly target — every foot adds to your commission.
 </div>}
 {svGoalPct>=100&&<div style={{padding:"8px 16px",background:T.successSoft,fontSize:12,color:T.success,fontWeight:600,textAlign:"center"}}>
 Region target exceeded! {$(svWeekData.commission)} in commission this week.
 </div>}
 </Card>}

 <div style={{display:"flex",gap:_m?6:10,marginBottom:_m?10:16,flexWrap:"wrap"}}>
 <Inp value={fl.search} onChange={v=>setFl({...fl,search:v})} ph={isLM?"Search feeder, location...":isRS?"Search feeder, OLT, location...":"Search ID, feeder, OLT, location..."} style={{marginBottom:0,flex:1,minWidth:_m?140:200}}/>
 {!isLM&&!isRS&&<Inp value={fl.status} onChange={v=>setFl({...fl,status:v})} options={Object.keys(STATUS_CFG)} style={{marginBottom:0,minWidth:_m?0:160,flex:_m?"1 1 45%":undefined}}/>}
 {!isLM&&!isRS&&<Inp value={fl.customer} onChange={v=>setFl({...fl,customer:v})} options={CUSTOMERS} style={{marginBottom:0,minWidth:_m?0:160,flex:_m?"1 1 45%":undefined}}/>}
 {isAdm&&<Inp value={fl.fin} onChange={v=>setFl({...fl,fin:v})} options={["Calculated","Missing Rate","No Production","Mapping Needed"]} style={{marginBottom:0,minWidth:_m?0:150,flex:_m?"1 1 100%":undefined}}/>}
 </div>

 {!isLM&&!isRS&&<div style={{display:"flex",gap:_m?4:6,marginBottom:8,alignItems:"center",overflowX:_m?"auto":"visible",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:_m?2:0}}>
 <span style={{fontSize:_m?10:11,color:T.textDim,fontWeight:600,flexShrink:0}}>Sort:</span>
 {[{k:"date",l:"Date"},{k:"status",l:"Status"},{k:"customer",l:"Customer"},{k:"id",l:"ID"},...(currentUser.role==="admin"?[{k:"revenue",l:"Revenue"}]:[])].map(s=>
 <button key={s.k} onClick={()=>toggleSort(s.k)} style={{padding:_m?"3px 8px":"3px 10px",borderRadius:5,fontSize:_m?10:11,fontWeight:600,border:`1px solid ${sortKey===s.k?T.accent:T.border}`,background:sortKey===s.k?T.accentSoft:"transparent",color:sortKey===s.k?T.accent:T.textMuted,cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap",flexShrink:0}}>
 {s.l}{sortKey===s.k?(sortDir==="asc"?" ▲":" ▼"):""}
 </button>
 )}
 </div>}

 <DT columns={cols} data={sorted} onRowClick={row=>setExpandedJobId(expandedJobId===row.id?null:row.id)} expandedId={expandedJobId} renderExpanded={row=><JobDetail job={row} inline/>}/>

 <Modal open={showC} onClose={()=>setShowC(false)} title="Create New Job" width={640}>
 {/* Department toggle */}
 <div style={{marginBottom:14}}>
 <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:0.4}}>Department</label>
 <div style={{display:"flex",gap:6}}>
 {[{k:"aerial",l:"Aerial",c:T.accent},{k:"underground",l:"Underground",c:T.cyan}].map(d=>
 <button key={d.k} onClick={()=>setNj({...nj,department:d.k,assignedLineman:"",assignedTruck:"",assignedDrill:""})} style={{
 flex:1,padding:"10px",borderRadius:4,fontSize:13,fontWeight:700,cursor:"pointer",
 border:`2px solid ${nj.department===d.k?d.c:T.border}`,
 background:nj.department===d.k?d.c+"18":"transparent",
 color:nj.department===d.k?d.c:T.textMuted,transition:"all 0.15s",
 }}>{d.l}</button>
 )}
 </div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:_m?"1fr":"1fr 1fr",gap:_m?"0":"0 16px"}}>
 <Inp label="Client" value={nj.client} onChange={v=>setNj({...nj,client:v})} options={CLIENTS}/>
 <Inp label="Customer" value={nj.customer} onChange={v=>setNj({...nj,customer:v})} options={CUSTOMERS}/>
 <Inp label="Region" value={nj.region} onChange={v=>setNj({...nj,region:v,location:""})} options={REGIONS}/>
 <Inp label="Location" value={nj.location} onChange={v=>setNj({...nj,location:v})} options={nj.region?LOCATIONS[nj.region]||[]:[]}/>
 <Inp label="OLT" value={nj.olt} onChange={v=>setNj({...nj,olt:v})} ph=""/>
 <Inp label="Feeder ID / Run" value={nj.feederId} onChange={v=>setNj({...nj,feederId:v})} ph=""/>
 {nj.department==="aerial"?<>
 <Inp label="Assign Lineman" value={nj.assignedLineman} onChange={v=>setNj({...nj,assignedLineman:v})} options={lms.map(l=>({value:l.id,label:l.name}))}/>
 <Inp label="Assign Truck" value={nj.assignedTruck} onChange={v=>setNj({...nj,assignedTruck:v})} options={trucks.map(t=>({value:t.id,label:`${t.id} — ${t.owner}`}))}/>
 </>:<>
 <Inp label="Assign Foreman" value={nj.assignedLineman} onChange={v=>setNj({...nj,assignedLineman:v})} options={fms.map(f=>({value:f.id,label:f.name}))}/>
 <Inp label="Assign Drill" value={nj.assignedDrill} onChange={v=>setNj({...nj,assignedDrill:v})} options={drills.map(d=>({value:d.id,label:`${d.id} — ${d.owner}`}))}/>
 </>}
 </div>
 {/* Map PDF Upload */}
 <div style={{marginTop:8,marginBottom:8}}>
 <label style={{fontSize:12,fontWeight:600,color:T.textMuted,display:"block",marginBottom:6}}>Map PDF</label>
 <div onClick={()=>setNj({...nj,mapPdf:nj.mapPdf?null:`Map_${nj.feederId||"Job"}.pdf`})}
 style={{padding:20,border:`2px dashed ${nj.mapPdf?T.success:T.border}`,borderRadius:4,textAlign:"center",cursor:"pointer",background:nj.mapPdf?T.successSoft:"transparent",transition:"all 0.15s"}}>
 {nj.mapPdf?<div>
 <span style={{fontSize:22}}></span>
 <div style={{fontSize:13,fontWeight:600,color:T.success,marginTop:4}}>{nj.mapPdf}</div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Click to remove</div>
 </div>:<div>
 <span style={{fontSize:28}}></span>
 <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>Upload map PDF for lineman</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Supports feeder, poles, and span maps</div>
 </div>}
 </div>
 </div>
 <Inp label="Supervisor Notes" value={nj.supervisorNotes} onChange={v=>setNj({...nj,supervisorNotes:v})} textarea/>
 <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:8}}>
 <Btn v="ghost" onClick={()=>setShowC(false)}>Cancel</Btn>
 <Btn onClick={handleC} disabled={!nj.customer||!nj.region||!nj.feederId}>Create Job</Btn>
 </div>
 </Modal>
 </div>;
}

// ─── JOB DETAIL ──────────────────────────────────────────────────────────────
function JobDetail({job:jobProp,inline}={})  {
 const{selectedJob,setSelectedJob,setView,jobs,setJobs,rateCards,currentUser}=useApp();
 const[tab,setTab]=useState(currentUser.role==="redline_specialist"?"redlines":(currentUser.role==="lineman"||currentUser.role==="foreman")&&!(jobProp||selectedJob)?.production?"production":"info");
 const emptyProdRow=()=>({spanWorkType:"S+F",strandSpan:"",anchora:false,fiberMarking:"",coil:false,poleTransfer:false,snowshoe:false});
 const[prodRows,setProdRows]=useState(()=>Array.from({length:12},()=>emptyProdRow()));
 // Underground foreman daily entries
 const[ugDays,setUgDays]=useState([{date:"",dayType:"full",conduitFeet:"",groundType:"Normal"}]);
 const addUgDay=()=>setUgDays([...ugDays,{date:"",dayType:"full",conduitFeet:"",groundType:"Normal"}]);
 const updUgDay=(i,k,v)=>{const n=[...ugDays];n[i]={...n[i],[k]:v};setUgDays(n);};
 const remUgDay=(i)=>{if(ugDays.length>1)setUgDays(ugDays.filter((_,j)=>j!==i));};
 const[pf,setPf]=useState({completedDate:"",comments:""});
 const[rn,setRn]=useState("");const[ra,setRa]=useState("");const[sri,setSri]=useState("");const[rjn,setRjn]=useState("");
 const[chatMsg,setChatMsg]=useState("");
 const[prodMapOpen,setProdMapOpen]=useState(false);
 // Document vault state
 const[docUpload,setDocUpload]=useState(false);
 const[newDoc,setNewDoc]=useState({type:"permit",name:"",notes:"",expires:""});
 const[docFilter,setDocFilter]=useState("all");
 const[docSearch,setDocSearch]=useState("");
 const[liveProdMode,setLiveProdMode]=useState(false);
 const[liveSession,setLiveSession]=useState(null);
 const[routeSetup,setRouteSetup]=useState(false);
 // RS confirming totals
 const[ct,setCt]=useState({strand:"",overlash:"",fiber:"",conduit:"",anchors:"",coils:"",snowshoes:"",dbNormal:"",dbCobble:"",dbRock:""});
 const j=jobProp||selectedJob;if(!j)return null;
 const lm=USERS.find(u=>u.id===j.assignedLineman);
 const isLM=currentUser.role==="lineman"||currentUser.role==="foreman";const isRS=currentUser.role==="redline_specialist";
 const isCR=currentUser.role==="client_manager";const isAdm=["admin","supervisor","billing"].includes(currentUser.role);
 const canFin=isAdm;
 const fin=useMemo(()=>calcJob(j,rateCards),[j,rateCards]);

 // ProdRow helpers
 const updProdRow=(i,k,v)=>setProdRows(prodRows.map((r,idx)=>idx===i?{...r,[k]:v}:r));
 const prodTotals=useMemo(()=>{
 const filled=prodRows.filter(r=>r.strandSpan||r.fiberMarking||r.anchora||r.coil||r.poleTransfer||r.snowshoe);
 const totalFeet=prodRows.reduce((s,r)=>s+(parseInt(r.strandSpan)||0),0);
 const coilCount=prodRows.filter(r=>r.coil).length;
 const coilBonusFt=coilCount*COIL_BONUS_FT;
 const sfFt=prodRows.filter(r=>(r.spanWorkType||"S+F")!=="Overlash").reduce((s,r)=>s+(parseInt(r.strandSpan)||0)+(r.coil?COIL_BONUS_FT:0),0);
 const ovlFt=prodRows.filter(r=>(r.spanWorkType||"S+F")==="Overlash").reduce((s,r)=>s+(parseInt(r.strandSpan)||0)+(r.coil?COIL_BONUS_FT:0),0);
 return{totalFeet:totalFeet+coilBonusFt,rawFeet:totalFeet,coilBonusFt,sfFt,ovlFt,entries:filled.length,anchors:prodRows.filter(r=>r.anchora).length,coils:coilCount,snowshoes:prodRows.filter(r=>r.snowshoe).length,poleTransfers:prodRows.filter(r=>r.poleTransfer).length};
 },[prodRows]);

 const isUG=j.department==="underground";
 const upd=(u,auditEntry)=>{const log=[...(j.auditLog||[])];if(auditEntry)log.push({...auditEntry,ts:new Date().toISOString(),actor:currentUser.id,actorName:currentUser.name});const up={...j,...u,auditLog:log,updatedAt:new Date().toISOString()};setJobs(jobs.map(x=>x.id===j.id?up:x));if(!inline)setSelectedJob(up);};
 const subProd=()=>{
 if(isUG){
 // Underground production submission
 const validDays=ugDays.filter(d=>d.date&&d.conduitFeet);
 const totalFeet=validDays.reduce((s,d)=>s+(parseInt(d.conduitFeet)||0),0);
 const p={completedDate:pf.completedDate,totalFeet,
 groundType:validDays[0]?.groundType||"Normal",
 days:validDays.map((d,i)=>({dayNum:i+1,date:d.date,fullDay:d.dayType==="full",halfDay:d.dayType==="half",conduitFeet:parseInt(d.conduitFeet)||0,groundType:d.groundType})),
 comments:pf.comments,submittedAt:new Date().toISOString(),submittedBy:currentUser.id};
 upd({production:p,workType:"Underground Boring",status:"Pending Redlines"},{action:"production_submitted",detail:`Underground production submitted: ${totalFeet} ft, ${validDays.length} day(s).`,from:j.status,to:"Pending Redlines"});setTab("production");
 } else {
 // Aerial production submission — Spectrum sheet format
 const filledRows=prodRows.filter(r=>r.strandSpan||r.fiberMarking||r.anchora||r.coil||r.poleTransfer||r.snowshoe);
 if(filledRows.length===0)return;
 const p={completedDate:pf.completedDate,totalFeet:prodTotals.totalFeet,
 totalStrand:prodTotals.sfFt,totalFiber:prodTotals.sfFt,totalOverlash:prodTotals.ovlFt,totalConduit:0,
 anchors:prodTotals.anchors,coils:prodTotals.coils,snowshoes:prodTotals.snowshoes,poleTransfers:prodTotals.poleTransfers,entries:filledRows.length,
 spans:prodRows.map((r,i)=>({spanId:i+1,spanWorkType:r.spanWorkType||"S+F",strandSpan:parseInt(r.strandSpan)||0,anchora:r.anchora,fiberMarking:r.fiberMarking,coil:r.coil,poleTransfer:r.poleTransfer,snowshoe:r.snowshoe})),
 comments:pf.comments,submittedAt:new Date().toISOString(),submittedBy:currentUser.id};
 upd({production:p,workType:"Strand",status:"Pending Redlines"},{action:"production_submitted",detail:`Aerial production submitted: ${prodTotals.totalFeet} ft, ${filledRows.length} spans.`,from:j.status,to:"Pending Redlines"});setTab("production");
 }
 };
 const upRL=()=>{
 const r={version:(j.redlines?.length||0)+1,fileName:`Redline_${j.feederId}_v${(j.redlines?.length||0)+1}.pdf`,uploadedAt:new Date().toISOString(),uploadedBy:currentUser.id,notes:rn};
 let confirmed;
 if(isUG){
 const days=j.production?.days||[];
 const ftByGT={Normal:0,Cobble:0,Rock:0};
 days.forEach(d=>{ftByGT[d.groundType||"Normal"]+=(d.conduitFeet||0);});
 const cNormal=parseInt(ct.dbNormal)||ftByGT.Normal;
 const cCobble=parseInt(ct.dbCobble)||ftByGT.Cobble;
 const cRock=parseInt(ct.dbRock)||ftByGT.Rock;
 confirmed={totalFeet:cNormal+cCobble+cRock,groundType:j.production?.groundType||"Normal",
 ftNormal:cNormal,ftCobble:cCobble,ftRock:cRock,
 confirmedBy:currentUser.id,confirmedAt:new Date().toISOString()};
 } else {
 const lmTypeTotals={Strand:0,Overlash:0,Fiber:0,"Fiber Conduit Pulling":0};
 (j.production?.spans||[]).forEach(sp=>{const wts=sp.workTypes||[];const ft=sp.strandSpan||0;wts.forEach(wt=>{lmTypeTotals[wt]=(lmTypeTotals[wt]||0)+ft;});});
 const cStrand=parseInt(ct.strand)||lmTypeTotals.Strand;
 const cOverlash=parseInt(ct.overlash)||lmTypeTotals.Overlash;
 const cFiber=parseInt(ct.fiber)||lmTypeTotals.Fiber;
 const cConduit=parseInt(ct.conduit)||lmTypeTotals["Fiber Conduit Pulling"];
 confirmed={totalFeet:cStrand+cOverlash+cFiber+cConduit,totalStrand:cStrand,totalOverlash:cOverlash,totalFiber:cFiber,totalConduit:cConduit,
 anchors:parseInt(ct.anchors)||j.production?.anchors||0,coils:parseInt(ct.coils)||j.production?.coils||0,snowshoes:parseInt(ct.snowshoes)||j.production?.snowshoes||0,entries:0,confirmedBy:currentUser.id,confirmedAt:new Date().toISOString()};
 }
 upd({redlines:[...(j.redlines||[]),r],confirmedTotals:confirmed,redlineStatus:"Uploaded",status:"Pending Redlines"},{action:"redline_uploaded",detail:`Redline v${(j.redlines?.length||0)+1} uploaded. Confirmed totals: ${confirmed.totalFeet} ft.${rn?` Notes: ${rn}`:""}`});setRn("");setCt({strand:"",overlash:"",fiber:"",conduit:"",anchors:"",coils:"",snowshoes:"",dbNormal:"",dbCobble:"",dbRock:""});
 };
 const subRev=()=>upd({redlineStatus:"Under Review",status:"Under Client Review"},{action:"submitted_for_review",detail:"Submitted for client review.",from:j.status,to:"Under Client Review"});
 const appJ=()=>{if(!sri)return;upd({status:"Ready to Invoice",redlineStatus:"Approved",srNumber:sri},{action:"approved",detail:`Approved with SR# ${sri}.${ra?` Notes: ${ra}`:""}`,from:j.status,to:"Ready to Invoice"});setRa("");setSri("");};
 const rejJ=()=>{upd({status:"Rejected",redlineStatus:"Rejected",reviewNotes:rjn},{action:"rejected",detail:`Rejected: ${rjn||"No reason provided."}`,from:j.status,to:"Rejected"});setRa("");setRjn("");};
 const sendChat=()=>{if(!chatMsg.trim())return;const m={id:"m"+Date.now(),userId:currentUser.id,text:chatMsg.trim(),ts:new Date().toISOString()};upd({messages:[...(j.messages||[]),m]});setChatMsg("");};

 const tabs=[{key:"info",label:"Job Info"}];
 if(j.production||isLM)tabs.push({key:"production",label:"Production"});
 if(isLM&&j.production)tabs.push({key:"my_earnings",label:"My Earnings"});
 if(!isLM)tabs.push({key:"redlines",label:"Redlines"});
 if(isCR||isAdm)tabs.push({key:"review",label:"Review"});
 if(canFin)tabs.push({key:"financials",label:"Financials"});
 const unread=(j.messages||[]).length;
 tabs.push({key:"chat",label:` Chat${unread>0?" ("+unread+")":""}`});
 const docCount=(j.documents||[]).length;
 tabs.push({key:"documents",label:`Documents${docCount>0?" ("+docCount+")":""}`});
 const logCount=(j.auditLog||[]).length;
 tabs.push({key:"activity",label:`Activity${logCount>0?" ("+logCount+")":""}`});

 return <div style={inline?{padding:"18px 22px"}:{}}>
 {!inline&&<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
 <Btn v="ghost" sz="sm" onClick={()=>{setSelectedJob(null);setView("jobs");}}>← Back</Btn>
 <div style={{flex:1}}>
 <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>{j.id}</h1>
 {!isLM&&<SB status={j.status}/>}
 {isLM&&(j.production?<Badge label="Submitted" color={T.success} bg={T.successSoft}/>:<Badge label="Needs Production" color={T.warning} bg={T.warningSoft}/>)}
 {canFin&&<FB status={fin.status}/>}
 </div>
 <p style={{color:T.textMuted,fontSize:13,margin:"2px 0 0"}}>{j.feederId} · {j.customer} · {j.location}{lm&&!isRS?"":(lm?` · Lineman: ${lm.name}`:"")}</p>
 </div>
 {j.srNumber&&!isRS&&<div style={{background:T.successSoft,padding:"6px 14px",borderRadius:4,display:"flex",alignItems:"center",gap:6}}>
 <span style={{fontSize:11,color:T.textMuted}}>SR#</span><span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:T.success}}>{j.srNumber}</span>
 </div>}
 </div>}

 {/* Inline mode header */}
 {inline&&<div style={{display:"flex",alignItems:"center",gap:_m?6:10,marginBottom:_m?10:14,flexWrap:"wrap"}}>
 <h2 style={{fontSize:_m?14:16,fontWeight:700,margin:0,color:T.text}}>{j.feederId}</h2>
 {!isLM&&<SB status={j.status}/>}
 {isLM&&(j.production?<Badge label="Submitted" color={T.success} bg={T.successSoft}/>:<Badge label="Needs Production" color={T.warning} bg={T.warningSoft}/>)}
 {canFin&&<FB status={fin.status}/>}
 <span style={{color:T.textMuted,fontSize:_m?10:12}}>{j.customer} · {j.region}{_m?"":" · "+j.olt}{lm?` · ${lm.name}`:""}</span>
 {j.srNumber&&<span style={{fontSize:_m?10:11,fontFamily:"monospace",color:T.success,fontWeight:700}}>SR# {j.srNumber}</span>}
 </div>}

 <TabBar tabs={tabs} active={tab} onChange={setTab}/>

 {tab==="info"&&<Card>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:12}}>Job Information</h3>
 {FR("Job ID",j.id)}{FR("Client",j.client)}{FR("Customer",j.customer)}{FR("Region",j.region)}{FR("Location",j.location)}{FR("OLT",j.olt)}{FR("Feeder ID / Run",j.feederId)}{FR("Assigned Lineman",lm?.name||"Unassigned")}{FR("Assigned Truck",j.assignedTruck)}{currentUser.role!=="client_manager"&&FR("Truck Investor",j.truckInvestor)}{FR("Status",j.status)}{FR("SR Number",j.srNumber)}
 {j.supervisorNotes&&<div style={{marginTop:16,padding:14,background:T.bgInput,borderRadius:4,borderLeft:`3px solid ${T.accent}`}}>
 <div style={{fontSize:11,fontWeight:600,color:T.accent,marginBottom:4}}>SUPERVISOR NOTES</div>
 <div style={{fontSize:13,color:T.text,lineHeight:1.5}}>{j.supervisorNotes}</div>
 </div>}
 {j.mapPdf?<div style={{marginTop:16,padding:16,background:T.successSoft,borderRadius:4,border:`1px solid ${T.success}33`,display:"flex",alignItems:"center",gap:12}}>
 <span style={{fontSize:28}}></span>
 <div style={{flex:1}}>
 <div style={{fontSize:13,fontWeight:700,color:T.text}}>Map PDF</div>
 <div style={{fontSize:12,color:T.success,fontWeight:600}}>{j.mapPdf}</div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Feeder route, poles, and spans for {j.feederId}</div>
 </div>
 <Btn v="success" sz="sm">View Map</Btn>
 </div>
 :<div style={{marginTop:16,padding:16,background:T.bgInput,borderRadius:4,border:`1px dashed ${T.border}`,display:"flex",alignItems:"center",gap:12}}>
 <span style={{fontSize:24,opacity:0.5}}></span>
 <div style={{flex:1}}>
 <div style={{fontSize:13,fontWeight:600,color:T.textDim}}>No Map Uploaded</div>
 <div style={{fontSize:11,color:T.textDim}}>Admin can upload a map PDF when editing this job.</div>
 </div>
 </div>}
 {isAdm&&j.department==="aerial"&&<div style={{marginTop:16}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <div><div style={{fontSize:13,fontWeight:700,color:T.text}}>Route Setup (Live Mode)</div><div style={{fontSize:11,color:T.textMuted}}>{j.routePoles?.length||0} poles · {(j.routePoles||[]).reduce((s,p)=>s+(p.distToNext||0),0)} ft total</div></div>
 <Btn sz="sm" v={routeSetup?"primary":"ghost"} onClick={()=>setRouteSetup(!routeSetup)}>{routeSetup?"Done":"Edit Route"}</Btn>
 </div>
 {routeSetup&&<Card style={{padding:14,borderColor:T.accent+"44"}}>
 <div style={{fontSize:11,color:T.textMuted,marginBottom:12}}>Add poles in order. Enter span distances from the construction map PDF.</div>
 {(j.routePoles||[]).map((pole,pi)=><div key={pole.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
 <div style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${T.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:T.accent,flexShrink:0}}>{pi+1}</div>
 <input value={pole.label} onChange={e=>{const rp=[...(j.routePoles||[])];rp[pi]={...rp[pi],label:e.target.value};upd({routePoles:rp});}} placeholder={`Pole ${pi+1}`} style={{width:80,padding:"6px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}/>
 <span style={{fontSize:11,color:T.textDim}}>→</span>
 <input type="number" value={pole.distToNext||""} onChange={e=>{const rp=[...(j.routePoles||[])];rp[pi]={...rp[pi],distToNext:parseInt(e.target.value)||0};upd({routePoles:rp});}} placeholder="ft" style={{width:60,padding:"6px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,fontFamily:"monospace"}}/>
 <span style={{fontSize:10,color:T.textDim}}>ft</span>
 <button onClick={()=>{const rp=(j.routePoles||[]).filter((_,i)=>i!==pi);upd({routePoles:rp});}} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:14,padding:2}}>✕</button>
 </div>)}
 <Btn sz="sm" onClick={()=>{const rp=[...(j.routePoles||[]),{id:"p"+Date.now(),label:"",distToNext:0}];upd({routePoles:rp});}}>+ Add Pole</Btn>
 {(j.routePoles?.length||0)>0&&<div style={{marginTop:10,padding:8,background:T.bgInput,borderRadius:6,fontSize:12}}><span style={{color:T.textMuted}}>Total:</span> <b style={{color:T.accent}}>{(j.routePoles||[]).reduce((s,p)=>s+(p.distToNext||0),0)} ft</b> · <b>{j.routePoles.length}</b> poles</div>}
 </Card>}
 {!routeSetup&&(j.routePoles?.length||0)>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>{j.routePoles.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:2}}><span style={{width:22,height:22,borderRadius:"50%",background:T.accentSoft,border:`1.5px solid ${T.accent}`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:T.accent}}>{p.label||i+1}</span>{i<j.routePoles.length-1&&<span style={{fontSize:9,color:T.textDim,fontFamily:"monospace"}}>{p.distToNext}→</span>}</div>)}</div>}
 </div>}

 </Card>}

 {tab==="production"&&<div>
 {/* ═══ MAP VIEWER — always shown in production tab ═══ */}
 <Card style={{marginBottom:14,padding:0,overflow:"hidden"}}>
 <button onClick={()=>setProdMapOpen(!prodMapOpen)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:`linear-gradient(135deg, ${T.accent}08, ${T.cyan}06)`,border:"none",cursor:"pointer",color:T.text}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:32,height:32,borderRadius:4,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
 </div>
 <div style={{textAlign:"left"}}><div style={{fontSize:14,fontWeight:700}}>Construction Map</div><div style={{fontSize:11,color:T.textMuted}}>{j.feederId} · {j.location} · Tap to {prodMapOpen?"collapse":"expand"}</div></div>
 </div>
 <span style={{fontSize:16,color:T.accent,transition:"transform 0.2s",transform:prodMapOpen?"rotate(180deg)":"rotate(0)"}}>{prodMapOpen?"▲":"▼"}</span>
 </button>
 {prodMapOpen&&<div style={{borderTop:`1px solid ${T.border}`}}>
 <iframe src={`/outputs/${j.mapPdf||"BSPD001_04H_Map.pdf"}`} style={{width:"100%",height:400,border:"none",display:"block"}} title="Construction Map PDF"/>
 <div style={{display:"flex",gap:8,padding:"8px 12px"}}>
 <a href={`/outputs/${j.mapPdf||"BSPD001_04H_Map.pdf"}`} target="_blank" rel="noopener noreferrer" style={{flex:1,padding:"8px 0",borderRadius:4,background:T.accentSoft,border:`1px solid ${T.accent}30`,color:T.accent,fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center",textDecoration:"none"}}>Open Full Screen</a>
 <a href={`/outputs/${j.mapPdf||"BSPD001_04H_Map.pdf"}`} download style={{flex:1,padding:"8px 0",borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`,color:T.textMuted,fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center",textDecoration:"none"}}>Download PDF</a>
 </div>
 </div>}
 </Card>

 {j.production?<>
 {/* ═══ SUBMITTED — READ-ONLY SPECTRUM PRODUCTION SHEET ═══ */}
 <Card style={{padding:0,overflow:"hidden",marginBottom:14}}>
 <div style={{padding:"12px 16px",background:`linear-gradient(135deg,${T.success}08,${T.success}04)`,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:28,height:28,borderRadius:6,background:T.success,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
 </div>
 <div>
 <div style={{fontSize:14,fontWeight:700,color:T.text}}>Production Sheet — Submitted</div>
 <div style={{fontSize:11,color:T.textMuted}}>{j.customer} · {j.feederId} · {fd(j.production.completedDate)}</div>
 </div>
 </div>
 <Badge label={`${j.production.totalFeet} ft`} color={T.success} bg={T.successSoft}/>
 </div>

 {isUG?(()=>{
 // Underground production — keep existing bore log view
 const gtColors={Normal:T.cyan,Cobble:T.warning,Rock:T.danger};
 const days=j.production.days||[];
 const totalFt=j.production.totalFeet||0;
 const ftByGT={};days.forEach(d=>{const gt=d.groundType||"Normal";ftByGT[gt]=(ftByGT[gt]||0)+(d.conduitFeet||0);});
 const gk=`${j.client}|${j.customer}|${j.region}`;const grp=rateCards[gk];
 const gtCodeMap={"Normal":"DB-Normal","Cobble":"DB-Cobble","Rock":"DB-Rock"};
 const codeEntries=Object.entries(ftByGT).map(([gt,ft])=>{const mapsTo=gtCodeMap[gt];const codeObj=grp?.codes?.find(c=>c.mapsTo===mapsTo);return{gt,ft,code:codeObj?.code||"—",desc:codeObj?.description||`Boring - ${gt}`,color:gtColors[gt]||T.text};}).filter(e=>e.ft>0);
 return <div style={{padding:16}}>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:10,marginBottom:16}}>
 <div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,marginBottom:2}}>Completed</div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{fd(j.production.completedDate)}</div></div>
 <div style={{padding:12,background:T.bgInput,borderRadius:4,borderTop:`2px solid ${T.accent}`}}><div style={{fontSize:11,color:T.accent,fontWeight:600,marginBottom:2}}>Total Conduit</div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{totalFt} ft</div></div>
 <div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,marginBottom:2}}>Work Days</div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{days.filter(d=>d.fullDay).length} full{days.filter(d=>d.halfDay).length>0?`, ${days.filter(d=>d.halfDay).length} half`:""}</div></div>
 </div>
 {codeEntries.length>0&&<>
 <h4 style={{fontSize:13,fontWeight:600,color:T.textMuted,marginBottom:8}}>Billing Code Breakdown</h4>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:10,marginBottom:16}}>
 {codeEntries.map(e=><div key={e.code} style={{padding:14,background:T.bgInput,borderRadius:4,borderLeft:`3px solid ${e.color}`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
 <span style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:"monospace"}}>{e.code}</span>
 <Badge label={e.gt} color={e.color} bg={e.color+"18"}/>
 </div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:4}}>{e.desc}</div>
 <div style={{fontSize:20,fontWeight:600,color:T.text}}>{e.ft} ft</div>
 </div>)}
 </div>
 </>}
 {days.length>0&&<>
 <h4 style={{fontSize:13,fontWeight:600,color:T.textMuted,marginBottom:8}}>Daily Bore Log</h4>
 <DT columns={[
 {key:"dayNum",label:"Day",render:r=><b>{r.dayNum}</b>},
 {key:"date",label:"Date",render:r=>fd(r.date)},
 {key:"dayType",label:"Type",render:r=>r.fullDay?<Badge label="Full Day" color={T.success} bg={T.successSoft}/>:<Badge label="Half Day" color={T.warning} bg={T.warningSoft}/>},
 {key:"conduitFeet",label:"Conduit Feet",render:r=><span style={{fontWeight:700}}>{r.conduitFeet} ft</span>},
 {key:"groundType",label:"Ground",render:r=><Badge label={r.groundType} color={gtColors[r.groundType]||T.text} bg={(gtColors[r.groundType]||T.text)+"18"}/>},
 {key:"code",label:"Code",render:r=>{const mt=gtCodeMap[r.groundType];const cd=grp?.codes?.find(c=>c.mapsTo===mt);return <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:T.accent}}>{cd?.code||"—"}</span>;}},
 ]} data={days}/>
 </>}
 </div>;
 })():(()=>{
 // ═══ AERIAL — READ-ONLY SPECTRUM PRODUCTION SHEET TABLE ═══
 const spans=j.production.spans||[];
 const wtBadge=(wt)=>{const m={"S+F":{l:"S+F",c:T.cyan},Overlash:{l:"OVL",c:T.warning},Strand:{l:"STR",c:T.cyan},Fiber:{l:"FBR",c:T.purple}};const o=m[wt]||m["S+F"];return <span style={{fontSize:8,fontWeight:700,color:o.c,background:o.c+"15",padding:"2px 4px",borderRadius:3,letterSpacing:0.3}}>{o.l}</span>;};
 const chkR=(v,color)=>v?<span style={{width:20,height:20,borderRadius:3,background:(color||T.success)+"18",border:`1.5px solid ${color||T.success}`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,color:color||T.success,fontWeight:700}}>✓</span>:<span style={{width:20,height:20,borderRadius:3,background:"transparent",border:`1.5px solid ${T.border}`,display:"inline-flex"}}></span>;
 const sfTotal=spans.filter(r=>(r.spanWorkType||"S+F")!=="Overlash").reduce((s,r)=>s+(r.strandSpan||0)+(r.coil?COIL_BONUS_FT:0),0);
 const ovlTotal=spans.filter(r=>(r.spanWorkType||"S+F")==="Overlash").reduce((s,r)=>s+(r.strandSpan||0)+(r.coil?COIL_BONUS_FT:0),0);
 const coilBonusFt=spans.filter(r=>r.coil).length*COIL_BONUS_FT;
 return <div>
 {/* Summary badges */}
 <div style={{display:"flex",gap:6,padding:"10px 12px",flexWrap:"wrap"}}>
 {sfTotal>0&&<div style={{padding:"6px 10px",background:T.cyan+"12",borderRadius:6,border:`1px solid ${T.cyan}25`}}><span style={{fontSize:10,fontWeight:700,color:T.cyan}}>S+F: {sfTotal.toLocaleString()} ft</span></div>}
 {ovlTotal>0&&<div style={{padding:"6px 10px",background:T.warning+"12",borderRadius:6,border:`1px solid ${T.warning}25`}}><span style={{fontSize:10,fontWeight:700,color:T.warning}}>OVL: {ovlTotal.toLocaleString()} ft</span></div>}
 {coilBonusFt>0&&<div style={{padding:"6px 10px",background:T.cyan+"08",borderRadius:6,border:`1px solid ${T.cyan}15`}}><span style={{fontSize:10,fontWeight:600,color:T.cyan}}>Coil bonus: +{coilBonusFt} ft</span></div>}
 </div>
 {/* Column headers */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 2.5fr 3fr 1.5fr 6fr 1.5fr 1.5fr 1.5fr",gap:4,padding:"8px 10px 6px",background:T.bgInput,borderBottom:`1px solid ${T.border}`}}>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>#</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Type</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Span</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Anchor</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Fiber Footage</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Coil</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center",lineHeight:1.1}}>P.T</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Snow</div>
 </div>
 {/* Data rows */}
 {spans.map((r,i)=>{
 const hasData=r.strandSpan||r.fiberMarking||r.anchora||r.coil||r.poleTransfer||r.snowshoe;
 return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 2.5fr 3fr 1.5fr 6fr 1.5fr 1.5fr 1.5fr",gap:4,padding:"5px 10px",alignItems:"center",borderBottom:`1px solid ${T.border}12`,background:hasData?T.success+"04":"transparent"}}>
 <div style={{fontSize:11,fontWeight:700,color:hasData?T.accent:T.textDim,textAlign:"center"}}>{r.spanId||i+1}</div>
 <div style={{textAlign:"center"}}>{wtBadge(r.spanWorkType||"S+F")}</div>
 <div style={{fontSize:13,fontWeight:700,color:r.strandSpan?T.text:T.textDim,fontFamily:"monospace",textAlign:"center"}}>{r.strandSpan||"—"}</div>
 <div style={{textAlign:"center"}}>{chkR(r.anchora||r.anchor,T.warning)}</div>
 <div style={{fontSize:11,fontWeight:600,color:r.fiberMarking?T.purple:T.textDim,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center"}}>{r.fiberMarking||"—"}</div>
 <div style={{textAlign:"center"}}>{chkR(r.coil,T.cyan)}</div>
 <div style={{textAlign:"center"}}>{chkR(r.poleTransfer,T.orange)}</div>
 <div style={{textAlign:"center"}}>{chkR(r.snowshoe,T.success)}</div>
 </div>;})}
 {/* Totals row */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 2.5fr 3fr 1.5fr 6fr 1.5fr 1.5fr 1.5fr",gap:4,padding:"8px 10px",alignItems:"center",background:T.accent+"08",borderTop:`2px solid ${T.accent}30`}}>
 <div style={{fontSize:10,fontWeight:700,color:T.accent,textAlign:"center"}}>Σ</div>
 <div style={{fontSize:9,color:T.textMuted,textAlign:"center"}}>{spans.length}</div>
 <div style={{fontSize:14,fontWeight:700,color:T.accent,fontFamily:"monospace",textAlign:"center"}}>{j.production.totalFeet?.toLocaleString()}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.warning,textAlign:"center"}}>{j.production.anchors||""}</div>
 <div style={{fontSize:10,color:T.textMuted,textAlign:"center"}}>{j.production.entries||spans.filter(s=>s.strandSpan||s.fiberMarking).length} entries</div>
 <div style={{fontSize:9,fontWeight:700,color:T.cyan,textAlign:"center"}}>{j.production.coils||""}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.orange,textAlign:"center"}}>{j.production.poleTransfers||""}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.success,textAlign:"center"}}>{j.production.snowshoes||""}</div>
 </div>
 </div>;
 })()}
 {j.production.comments&&<div style={{margin:"0 16px 16px",padding:12,background:T.bgInput,borderRadius:4,borderLeft:`3px solid ${T.warning}`}}>
 <div style={{fontSize:11,fontWeight:600,color:T.warning,marginBottom:4}}>{isUG?"FOREMAN":"LINEMAN"} COMMENTS</div><div style={{fontSize:13,color:T.text}}>{j.production.comments}</div>
 </div>}
 <div style={{padding:"0 16px 16px",fontSize:11,color:T.textDim}}>Submitted {fdt(j.production.submittedAt)} by {USERS.find(u=>u.id===j.production.submittedBy)?.name||"Unknown"}</div>
 </Card>
 </>

 :isLM&&j.assignedLineman===currentUser.id?<div>
 {/* ═══ MODE TOGGLE ═══ */}
 {!isUG&&<Card style={{marginBottom:14,padding:0,overflow:"hidden"}}>
 <div style={{display:"flex"}}>
 <button onClick={()=>setLiveProdMode(false)} style={{flex:1,padding:"14px",border:"none",borderBottom:`3px solid ${!liveProdMode?T.accent:"transparent"}`,background:!liveProdMode?T.accentSoft:"transparent",color:!liveProdMode?T.accent:T.textMuted,fontSize:13,fontWeight:700,cursor:"pointer"}}>Production Sheet</button>
 <button onClick={()=>setLiveProdMode(true)} style={{flex:1,padding:"14px",border:"none",borderBottom:`3px solid ${liveProdMode?T.success:"transparent"}`,background:liveProdMode?T.successSoft:"transparent",color:liveProdMode?T.success:T.textMuted,fontSize:13,fontWeight:700,cursor:"pointer"}}>Live Mode {(j.routePoles?.length||0)>0&&<span style={{background:T.success,color:"#fff",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,marginLeft:4}}>{j.routePoles.length} poles</span>}</button>
 </div></Card>}

 {liveProdMode&&!isUG&&<div>
 {(!j.routePoles||j.routePoles.length<2)?<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:4}}>Route Not Set Up Yet</div><div style={{fontSize:13,color:T.textMuted}}>Admin needs to set up the pole route first. Use Production Sheet for now.</div><Btn onClick={()=>setLiveProdMode(false)} style={{marginTop:16}}>Switch to Sheet</Btn></Card>
 :<LiveModeMap job={j} liveSession={liveSession} setLiveSession={setLiveSession} onSubmit={()=>{const spns=liveSession.spans.map((sp,i)=>({spanId:i+1,spanWorkType:sp.workTypes[0]||"S+F",strandSpan:sp.footage,anchora:sp.anchor,fiberMarking:sp.fiberSeq||"",coil:sp.coil,poleTransfer:sp.poleTransfer,snowshoe:sp.snowshoe}));const totalFeet=spns.reduce((s,sp)=>s+sp.strandSpan,0);const p={completedDate:pf.completedDate,totalFeet,totalStrand:totalFeet,totalFiber:totalFeet,totalOverlash:0,totalConduit:0,anchors:spns.filter(s=>s.anchora).length,coils:spns.filter(s=>s.coil).length,snowshoes:spns.filter(s=>s.snowshoe).length,poleTransfers:spns.filter(s=>s.poleTransfer).length,entries:spns.length,spans:spns,liveMode:true,comments:pf.comments,submittedAt:new Date().toISOString(),submittedBy:currentUser.id};upd({production:p,workType:"Strand",status:"Pending Redlines"});setTab("production");setLiveSession(null);}} pf={pf} setPf={setPf} currentUser={currentUser}/>}
 </div>}

 <div style={{display:(!liveProdMode||isUG)?"block":"none"}}>
 {/* ═══ PRODUCTION ENTRY FORM — SPECTRUM SHEET FORMAT ═══ */}
 <Card style={{marginBottom:14,padding:16}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
 <h3 style={{fontSize:16,fontWeight:700,color:T.text,margin:0}}>{isUG?"Underground Bore Log":"Production Sheet"}</h3>
 {isUG&&<Badge label="Underground" color={T.orange} bg={T.orangeSoft}/>}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:12}}>
 <div style={{padding:8,background:T.bgInput,borderRadius:6}}><span style={{color:T.textMuted}}>Feeder:</span> <b style={{color:T.text}}>{j.feederId}</b></div>
 <div style={{padding:8,background:T.bgInput,borderRadius:6}}><span style={{color:T.textMuted}}>OLT:</span> <b style={{color:T.text}}>{j.olt}</b></div>
 <div style={{padding:8,background:T.bgInput,borderRadius:6}}><span style={{color:T.textMuted}}>Location:</span> <b style={{color:T.text}}>{j.location}</b></div>
 {!isUG&&<div style={{padding:8,background:T.bgInput,borderRadius:6}}><span style={{color:T.textMuted}}>Poles:</span> <b style={{color:T.text}}>{j.poleCount||prodRows.length}</b></div>}
 </div>
 </Card>

 {isUG?<>
 {/* ── UNDERGROUND FOREMAN: DAILY ENTRIES — unchanged ── */}
 <div style={{marginBottom:14}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,margin:0}}>Daily Entries ({ugDays.length})</h3>
 <Btn sz="sm" onClick={addUgDay}>+ Add Day</Btn>
 </div>
 {ugDays.map((d,i)=>{
 const gtColors={Normal:T.cyan,Cobble:T.warning,Rock:T.danger};
 return <Card key={i} style={{marginBottom:10,padding:14,borderLeft:`3px solid ${gtColors[d.groundType]||T.border}`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <span style={{fontSize:13,fontWeight:700,color:T.text}}>Day {i+1}</span>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <Badge label={d.groundType} color={gtColors[d.groundType]||T.text} bg={(gtColors[d.groundType]||T.text)+"18"}/>
 {ugDays.length>1&&<button onClick={()=>remUgDay(i)} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16,padding:2}}>✕</button>}
 </div>
 </div>
 <div style={{marginBottom:10}}>
 <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase"}}>Date</label>
 <input type="date" value={d.date} onChange={e=>updUgDay(i,"date",e.target.value)} style={{width:"100%",boxSizing:"border-box",background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4,padding:"10px 12px",fontSize:14,outline:"none"}}/>
 </div>
 <div style={{marginBottom:10}}>
 <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase"}}>Day Type</label>
 <div style={{display:"flex",gap:6}}>
 {[{v:"full",l:"Full Day ($300)"},{v:"half",l:"Half Day ($150)"}].map(o=>
 <button key={o.v} onClick={()=>updUgDay(i,"dayType",o.v)} style={{flex:1,padding:"10px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",
 border:`2px solid ${d.dayType===o.v?T.success:T.border}`,background:d.dayType===o.v?T.successSoft:"transparent",color:d.dayType===o.v?T.success:T.textMuted}}>{o.l}</button>)}
 </div>
 </div>
 <div style={{marginBottom:10}}>
 <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase"}}>Conduit Feet</label>
 <input type="number" inputMode="numeric" value={d.conduitFeet} onChange={e=>updUgDay(i,"conduitFeet",e.target.value)} placeholder="0"
 style={{width:"100%",boxSizing:"border-box",background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4,padding:"10px 12px",fontSize:16,outline:"none"}}/>
 {d.conduitFeet&&<div style={{fontSize:11,color:T.textMuted,marginTop:4}}>Rate: {parseInt(d.conduitFeet)>500?"$0.30/ft (>500)":"$0.25/ft (≤500)"}</div>}
 </div>
 <div>
 <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase"}}>Ground Type</label>
 <div style={{display:"flex",gap:4}}>
 {GROUND_TYPES.map(gt=>{const active=d.groundType===gt;
 return <button key={gt} onClick={()=>updUgDay(i,"groundType",gt)} style={{flex:1,padding:"8px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",
 border:`2px solid ${active?gtColors[gt]:T.border}`,background:active?gtColors[gt]+"18":"transparent",color:active?gtColors[gt]:T.textMuted}}>{gt}</button>;})}
 </div>
 </div>
 </Card>;
 })}
 <Btn v="outline" sz="sm" onClick={addUgDay} style={{width:"100%",padding:"12px",marginTop:4}}>+ Add Another Day</Btn>
 </div>

 {/* Running totals for UG */}
 {(()=>{
 const totalFt=ugDays.reduce((s,d)=>s+(parseInt(d.conduitFeet)||0),0);
 const fullDays=ugDays.filter(d=>d.dayType==="full").length;
 const halfDays=ugDays.filter(d=>d.dayType==="half").length;
 const condLt=ugDays.reduce((s,d)=>{const ft=parseInt(d.conduitFeet)||0;return s+(ft<=500?ft:0);},0);
 const condGt=ugDays.reduce((s,d)=>{const ft=parseInt(d.conduitFeet)||0;return s+(ft>500?ft:0);},0);
 const estPay=(fullDays*UG_PAY.fullDay)+(halfDays*UG_PAY.halfDay)+(condLt*UG_PAY.conduitLt)+(condGt*UG_PAY.conduitGt)+(totalFt>=4000?UG_PAY.weeklyBonus:0);
 return <Card style={{marginBottom:14,padding:14,background:T.bgCard,borderColor:T.accent+"44"}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:8,textTransform:"uppercase"}}>Running Totals</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8}}>
 <div style={{textAlign:"center",padding:8,background:T.bgInput,borderRadius:6}}><div style={{fontSize:18,fontWeight:600,color:T.text}}>{totalFt}</div><div style={{fontSize:10,color:T.accent}}>Conduit ft</div></div>
 <div style={{textAlign:"center",padding:8,background:T.bgInput,borderRadius:6}}><div style={{fontSize:18,fontWeight:600,color:T.text}}>{fullDays}</div><div style={{fontSize:10,color:T.textMuted}}>Full Days</div></div>
 <div style={{textAlign:"center",padding:8,background:T.bgInput,borderRadius:6}}><div style={{fontSize:18,fontWeight:600,color:T.text}}>{halfDays}</div><div style={{fontSize:10,color:T.textMuted}}>Half Days</div></div>
 </div>
 <div style={{marginTop:10,textAlign:"center",padding:10,background:T.successSoft,borderRadius:6,border:`1px solid ${T.success}33`}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Est. Pay</div>
 <div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(estPay)}</div>
 {totalFt>=4000&&<div style={{fontSize:11,color:T.success,marginTop:2}}>Includes $300 weekly bonus!</div>}
 </div>
 </Card>;
 })()}
 </>:<>
 {/* ═══ AERIAL — EDITABLE SPECTRUM PRODUCTION SHEET ═══ */}
 <Card style={{padding:0,overflow:"hidden",marginBottom:14}}>
 <div style={{padding:"10px 14px",background:`linear-gradient(135deg,${T.accent}08,${T.accent}04)`,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <div style={{width:26,height:26,borderRadius:6,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
 </div>
 <div><div style={{fontSize:13,fontWeight:700,color:T.text}}>Production Sheet</div><div style={{fontSize:10,color:T.textMuted}}>{j.customer} · {j.feederId}</div></div>
 </div>
 <div style={{fontSize:12,fontWeight:700,color:T.accent}}>{prodRows.length} poles</div>
 </div>

 {/* Column headers */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 2.5fr 3fr 1.5fr 6fr 1.5fr 1.5fr 1.5fr",gap:4,padding:"8px 8px 6px",background:T.bgInput,borderBottom:`1px solid ${T.border}`}}>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>#</div>
 {(()=>{const allOvl=prodRows.every(r=>(r.spanWorkType||"S+F")==="Overlash");const c=allOvl?T.warning:T.cyan;return <button onClick={()=>setProdRows(prodRows.map(r=>({...r,spanWorkType:allOvl?"S+F":"Overlash"})))} style={{background:c+"12",border:`1.5px solid ${c}35`,borderRadius:4,padding:"3px 2px",cursor:"pointer",fontSize:8,fontWeight:700,color:c,textTransform:"uppercase",textAlign:"center",letterSpacing:0.3}}>⇅ {allOvl?"OVL":"S+F"}</button>;})()}
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Span</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Anchor</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Fiber Footage</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Coil</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center",lineHeight:1.1}}>P.T</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Snow</div>
 </div>

 {/* Editable data rows */}
 {prodRows.map((r,i)=>{
 const hasData=r.strandSpan||r.fiberMarking||r.anchora||r.coil||r.poleTransfer||r.snowshoe;
 const wt=r.spanWorkType||"S+F";
 const wtC=wt==="Overlash"?T.warning:T.cyan;
 const chk=(k,color)=><button onClick={()=>updProdRow(i,k,!r[k])} style={{width:"100%",height:28,borderRadius:4,border:`1.5px solid ${r[k]?color:T.border}`,background:r[k]?color+"18":"transparent",color:r[k]?color:T.textDim,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.12s",padding:0}}>{r[k]?"✓":""}</button>;
 return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 2.5fr 3fr 1.5fr 6fr 1.5fr 1.5fr 1.5fr",gap:4,padding:"3px 8px",alignItems:"center",borderBottom:`1px solid ${T.border}15`,background:hasData?T.success+"04":"transparent"}}>
 <div style={{fontSize:11,fontWeight:700,color:hasData?T.accent:T.textDim,textAlign:"center"}}>{i+1}</div>
 <button onClick={()=>updProdRow(i,"spanWorkType",wt==="Overlash"?"S+F":"Overlash")} style={{width:"100%",padding:"6px 2px",borderRadius:4,border:`1.5px solid ${wtC}40`,background:wtC+"10",color:wtC,fontSize:10,fontWeight:700,cursor:"pointer",textAlign:"center",letterSpacing:0.3}}>{wt==="Overlash"?"OVL":"S+F"}</button>
 <input type="number" inputMode="numeric" value={r.strandSpan} placeholder="ft" onChange={e=>updProdRow(i,"strandSpan",e.target.value)}
 style={{background:r.strandSpan?T.accent+"06":T.bgInput,color:T.text,border:`1px solid ${r.strandSpan?T.accent+"35":T.border}`,borderRadius:5,padding:"6px 6px",fontSize:13,fontWeight:600,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"monospace"}}/>
 {chk("anchora",T.warning)}
 <input type="text" value={r.fiberMarking} placeholder="—" onChange={e=>updProdRow(i,"fiberMarking",e.target.value)}
 style={{background:r.fiberMarking?T.purple+"06":T.bgInput,color:T.text,border:`1px solid ${r.fiberMarking?T.purple+"35":T.border}`,borderRadius:5,padding:"6px 6px",fontSize:11,fontFamily:"monospace",fontWeight:600,outline:"none",width:"100%",boxSizing:"border-box"}}/>
 {chk("coil",T.cyan)}
 {chk("poleTransfer",T.orange)}
 {chk("snowshoe",T.success)}
 </div>;})}

 {/* Total row */}
 <div style={{padding:"8px 8px",background:T.accent+"08",borderTop:`2px solid ${T.accent}30`}}>
 <div style={{display:"grid",gridTemplateColumns:"1fr 2.5fr 3fr 1.5fr 6fr 1.5fr 1.5fr 1.5fr",gap:4,alignItems:"center"}}>
 <div style={{fontSize:10,fontWeight:700,color:T.accent,textAlign:"center"}}>Σ</div>
 <div style={{fontSize:9,color:T.textMuted}}>{prodRows.length}</div>
 <div style={{fontSize:13,fontWeight:700,color:T.accent,fontFamily:"monospace"}}>{prodTotals.totalFeet.toLocaleString()}{prodTotals.coilBonusFt>0?<span style={{fontSize:9,color:T.cyan,fontWeight:600}}> (+{prodTotals.coilBonusFt})</span>:""}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.warning,textAlign:"center"}}>{prodTotals.anchors||""}</div>
 <div style={{fontSize:10,color:T.textMuted}}>{prodTotals.entries} entries</div>
 <div style={{fontSize:9,fontWeight:700,color:T.cyan,textAlign:"center"}}>{prodTotals.coils||""}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.orange,textAlign:"center"}}>{prodTotals.poleTransfers||""}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.success,textAlign:"center"}}>{prodTotals.snowshoes||""}</div>
 </div>
 {(prodTotals.sfFt>0||prodTotals.ovlFt>0)&&<div style={{display:"flex",gap:6,marginTop:6,paddingLeft:26,flexWrap:"wrap"}}>
 {prodTotals.sfFt>0&&<span style={{fontSize:10,fontWeight:700,color:T.cyan,background:T.cyan+"12",padding:"2px 6px",borderRadius:4}}>S+F: {prodTotals.sfFt.toLocaleString()} ft</span>}
 {prodTotals.ovlFt>0&&<span style={{fontSize:10,fontWeight:700,color:T.warning,background:T.warning+"12",padding:"2px 6px",borderRadius:4}}>OVL: {prodTotals.ovlFt.toLocaleString()} ft</span>}
 {prodTotals.coilBonusFt>0&&<span style={{fontSize:9,fontWeight:600,color:T.cyan,background:T.cyan+"08",padding:"2px 6px",borderRadius:4,border:`1px solid ${T.cyan}20`}}>Coil bonus: +{prodTotals.coilBonusFt} ft</span>}
 </div>}
 </div>

 {/* Add/Remove buttons */}
 <div style={{display:"flex",gap:6,padding:"8px 8px 10px"}}>
 <button onClick={()=>setProdRows([...prodRows,emptyProdRow()])} style={{flex:1,padding:"10px 0",borderRadius:4,background:"transparent",border:`2px dashed ${T.border}`,color:T.textMuted,fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add Row</button>
 {prodRows.length>1&&<button onClick={()=>{
 const lastEmpty=prodRows.map((r,i)=>({r,i})).reverse().find(x=>!x.r.strandSpan&&!x.r.fiberMarking&&!x.r.anchora&&!x.r.coil&&!x.r.poleTransfer&&!x.r.snowshoe);
 if(lastEmpty)setProdRows(prodRows.filter((_,i)=>i!==lastEmpty.i));
 else setProdRows(prodRows.slice(0,-1));
 }} style={{padding:"10px 14px",borderRadius:4,background:T.dangerSoft,border:`1px solid ${T.danger}30`,color:T.danger,fontSize:13,fontWeight:600,cursor:"pointer"}}>− Remove</button>}
 </div>
 </Card>
 </>}

 <Card style={{marginBottom:14,padding:14}}>
 <Inp label="Comments / Field Notes" textarea value={pf.comments} onChange={v=>setPf({...pf,comments:v})} ph={isUG?"Ground conditions, obstacles, notes...":"Reroutes, obstacles, notes for redline specialist..."}/>
 </Card>

 <div style={{marginBottom:14,display:"flex",gap:12,alignItems:"flex-end"}}>
 <div style={{width:200}}>
 <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:5,letterSpacing:0.4,textTransform:"uppercase"}}>Date Completed</label>
 <input type="date" value={pf.completedDate} onChange={e=>setPf({...pf,completedDate:e.target.value})} onKeyDown={e=>e.preventDefault()} onClick={e=>e.target.showPicker&&e.target.showPicker()}
 style={{width:"100%",boxSizing:"border-box",background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4,padding:"10px 12px",fontSize:13,outline:"none",cursor:"pointer"}}/>
 </div>
 {isUG?<Btn onClick={subProd} disabled={!pf.completedDate||ugDays.every(d=>!d.conduitFeet||!d.date)} style={{flex:1,padding:"12px 0",fontSize:14,textAlign:"center"}}>
 Submit Production ({ugDays.filter(d=>d.date&&d.conduitFeet).length} days)
 </Btn>
 :<Btn onClick={subProd} disabled={!pf.completedDate||prodTotals.entries===0} style={{flex:1,padding:"12px 0",fontSize:14,textAlign:"center"}}>
 Submit Production ({prodTotals.entries} entries · {prodTotals.totalFeet.toLocaleString()} ft)
 </Btn>}
 </div>
 </div>
 </div>

 :<Card><p style={{color:T.textMuted,textAlign:"center",padding:24}}>No production submitted yet.</p></Card>}
 </div>}

 {/* ── MY EARNINGS TAB (lineman only) ── */}
 {tab==="my_earnings"&&isLM&&<div>
 {fin.status==="Calculated"&&fin.totals?<>
 <Card style={{marginBottom:16,padding:24,background:`linear-gradient(135deg, ${T.bgCard}, rgba(16,185,129,0.08))`,borderColor:T.success+"44"}}>
 <div style={{textAlign:"center",marginBottom:20}}>
 <div style={{fontSize:12,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Your Earnings on This Job</div>
 <div style={{fontSize:40,fontWeight:600,color:T.success,lineHeight:1}}>{$(fin.totals.linemanPay)}</div>
 <div style={{marginTop:10}}>
 {j.billedAt?<Badge label=" Billed — Official" color={T.success} bg={T.successSoft}/>
 :j.confirmedTotals?<Badge label="Confirmed by Redline Specialist" color={T.cyan} bg={T.cyanSoft}/>
 :<Badge label="Estimated — Pending RS Confirmation" color={T.warning} bg={T.warningSoft}/>}
 </div>
 {!j.billedAt&&<div style={{fontSize:11,color:T.textDim,marginTop:6}}>
 {j.confirmedTotals?"These numbers are confirmed but not yet billed. Final amount may change if client requests adjustments."
 :"These numbers are based on your submitted production. They may change after the redline specialist confirms totals."}
 </div>}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
 {fin.items.filter(i=>i.linemanAmount!=null&&i.linemanAmount>0).map((item,idx)=>
 <div key={idx} style={{padding:14,background:T.bgInput,borderRadius:4}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{item.description}</div>
 <div style={{fontSize:15,fontWeight:600,color:T.success}}>{$(item.linemanAmount)}</div>
 </div>
 <div style={{display:"flex",gap:12,fontSize:11,color:T.textMuted}}>
 <span>{item.qty} {item.unit==="per foot"?"ft":"units"}</span>
 <span>× {$(item.linemanRate)}{item.unit==="per foot"?"/ft":"/ea"}</span>
 </div>
 </div>
 )}
 </div>
 </Card>
 <Card style={{padding:14}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.4,marginBottom:8}}>Earnings Breakdown</div>
 <DT columns={[
 {key:"d",label:"Item",render:r=><span style={{fontWeight:600}}>{r.description}</span>},
 {key:"q",label:"Qty",render:r=><b>{r.qty}</b>},
 {key:"u",label:"Unit",render:r=><span style={{fontSize:11,color:T.textMuted}}>{r.unit}</span>},
 {key:"r",label:"Your Rate",render:r=><span style={{color:T.accent,fontWeight:600}}>{r.linemanRate!=null?`${$(r.linemanRate)}${r.unit==="per foot"?"/ft":"/ea"}`:"—"}</span>},
 {key:"a",label:"Your Earnings",render:r=><b style={{color:T.success,fontSize:14}}>{$(r.linemanAmount)}</b>},
 ]} data={fin.items.filter(i=>i.linemanAmount!=null)}/>
 <div style={{display:"flex",justifyContent:"flex-end",marginTop:14,padding:"12px 14px",background:T.successSoft,borderRadius:4}}>
 <span style={{fontSize:15,fontWeight:600,color:T.success}}>Total: {$(fin.totals.linemanPay)}</span>
 </div>
 </Card>
 </>
 :<Card style={{borderLeft:`3px solid ${T.warning}`,padding:20}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <span style={{fontSize:28}}></span>
 <div>
 <div style={{fontSize:14,fontWeight:600,color:T.text}}>Earnings not yet available</div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{fin.error||"Your earnings will appear once production is submitted and rates are calculated."}</div>
 </div>
 </div>
 </Card>}
 </div>}

 {tab==="redlines"&&<div>
 {/* Rejection banner — shown first for RS so they immediately see why */}
 {isRS&&j.reviewNotes&&j.redlineStatus==="Rejected"&&<Card style={{marginBottom:16,borderLeft:`3px solid ${T.danger}`,background:`linear-gradient(135deg, ${T.bgCard}, ${T.dangerSoft})`}}>
 <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
 <span style={{width:24,height:24,borderRadius:12,background:T.danger,display:"inline-block"}}></span>
 <div style={{flex:1}}>
 <div style={{fontSize:14,fontWeight:700,color:T.danger,marginBottom:6}}>Redline Rejected — Fix Required</div>
 <div style={{fontSize:13,color:T.text,lineHeight:1.6,padding:12,background:T.bgInput,borderRadius:4,borderLeft:`3px solid ${T.danger}`}}>{j.reviewNotes}</div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:8}}>Upload a corrected redline below to resubmit.</div>
 </div>
 </div>
 </Card>}
 {isRS&&j.redlineStatus==="Approved"&&<Card style={{marginBottom:16,borderLeft:`3px solid ${T.success}`,background:`linear-gradient(135deg, ${T.bgCard}, ${T.bgCard})`}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <span style={{fontSize:24}}></span>
 <div><div style={{fontSize:14,fontWeight:700,color:T.success}}>Redline Approved</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>No further action needed on this job.</div></div>
 </div>
 </Card>}
 {isRS&&(j.redlineStatus==="Under Review")&&<Card style={{marginBottom:16,borderLeft:`3px solid ${T.purple}`,padding:14}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <span style={{fontSize:20}}></span>
 <div style={{fontSize:13,fontWeight:600,color:T.purple}}>Awaiting client review — you'll be notified when they respond.</div>
 </div>
 </Card>}

 {/* ═══ RS REFERENCE: MAP + PRODUCTION SHEET ═══ */}
 {isRS&&j.production&&!isUG&&<>
 {/* Map for RS reference */}
 <Card style={{marginBottom:12,padding:0,overflow:"hidden"}}>
 <button onClick={()=>setProdMapOpen(!prodMapOpen)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:`linear-gradient(135deg, ${T.accent}08, ${T.cyan}06)`,border:"none",cursor:"pointer",color:T.text}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:30,height:30,borderRadius:4,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
 </div>
 <div style={{textAlign:"left"}}><div style={{fontSize:13,fontWeight:700}}>Construction Map</div><div style={{fontSize:10,color:T.textMuted}}>{j.feederId} · {j.location}</div></div>
 </div>
 <span style={{fontSize:14,color:T.accent}}>{prodMapOpen?"▲":"▼"}</span>
 </button>
 {prodMapOpen&&<div style={{borderTop:`1px solid ${T.border}`}}>
 <iframe src={`/outputs/${j.mapPdf||"BSPD001_04H_Map.pdf"}`} style={{width:"100%",height:380,border:"none",display:"block"}} title="Construction Map PDF"/>
 <div style={{display:"flex",gap:6,padding:"8px 10px"}}>
 <a href={`/outputs/${j.mapPdf||"BSPD001_04H_Map.pdf"}`} target="_blank" rel="noopener noreferrer" style={{flex:1,padding:"8px 0",borderRadius:4,background:T.accentSoft,border:`1px solid ${T.accent}30`,color:T.accent,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center",textDecoration:"none"}}>Open Full Screen</a>
 <a href={`/outputs/${j.mapPdf||"BSPD001_04H_Map.pdf"}`} download style={{flex:1,padding:"8px 0",borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`,color:T.textMuted,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center",textDecoration:"none"}}>Download PDF</a>
 </div>
 </div>}
 </Card>

 {/* Read-only Production Sheet for RS */}
 <Card style={{marginBottom:16,padding:0,overflow:"hidden"}}>
 <div style={{padding:"10px 14px",background:`linear-gradient(135deg,${T.success}06,${T.success}03)`,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <div style={{width:24,height:24,borderRadius:5,background:T.success,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
 </div>
 <div><div style={{fontSize:13,fontWeight:700,color:T.text}}>Lineman Production Sheet</div><div style={{fontSize:10,color:T.textMuted}}>Submitted {fdt(j.production.submittedAt)} · {j.production.totalFeet} ft total</div></div>
 </div>
 </div>
 {(()=>{
 const spans=j.production.spans||[];
 const wtBadge=(wt)=>{const m={"S+F":{l:"S+F",c:T.cyan},Overlash:{l:"OVL",c:T.warning}};const o=m[wt]||m["S+F"];return <span style={{fontSize:8,fontWeight:700,color:o.c,background:o.c+"15",padding:"2px 4px",borderRadius:3}}>{o.l}</span>;};
 const chkR=(v,color)=>v?<span style={{width:18,height:18,borderRadius:3,background:(color||T.success)+"18",border:`1.5px solid ${color||T.success}`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,color:color||T.success,fontWeight:700}}>✓</span>:<span style={{width:18,height:18,borderRadius:3,background:"transparent",border:`1.5px solid ${T.border}`,display:"inline-flex"}}></span>;
 return <>
 <div style={{display:"grid",gridTemplateColumns:"1fr 2.2fr 2.8fr 1.3fr 5fr 1.3fr 1.3fr 1.3fr",gap:4,padding:"7px 8px 5px",background:T.bgInput,borderBottom:`1px solid ${T.border}`}}>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>#</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Type</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Span</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Anchor</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Fiber Footage</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Coil</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>P.T</div>
 <div style={{fontSize:8,fontWeight:700,color:T.textMuted,textTransform:"uppercase",textAlign:"center"}}>Snow</div>
 </div>
 {spans.map((r,i)=>{
 const hasData=r.strandSpan||r.fiberMarking||r.anchora||r.anchor||r.coil||r.poleTransfer||r.snowshoe;
 return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 2.2fr 2.8fr 1.3fr 5fr 1.3fr 1.3fr 1.3fr",gap:4,padding:"4px 8px",alignItems:"center",borderBottom:`1px solid ${T.border}12`,background:hasData?T.success+"04":"transparent"}}>
 <div style={{fontSize:10,fontWeight:700,color:hasData?T.accent:T.textDim,textAlign:"center"}}>{r.spanId||i+1}</div>
 <div style={{textAlign:"center"}}>{wtBadge(r.spanWorkType||"S+F")}</div>
 <div style={{fontSize:12,fontWeight:700,color:r.strandSpan?T.text:T.textDim,fontFamily:"monospace",textAlign:"center"}}>{r.strandSpan||"—"}</div>
 <div style={{textAlign:"center"}}>{chkR(r.anchora||r.anchor,T.warning)}</div>
 <div style={{fontSize:10,fontWeight:600,color:r.fiberMarking?T.purple:T.textDim,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center"}}>{r.fiberMarking||"—"}</div>
 <div style={{textAlign:"center"}}>{chkR(r.coil,T.cyan)}</div>
 <div style={{textAlign:"center"}}>{chkR(r.poleTransfer,T.orange)}</div>
 <div style={{textAlign:"center"}}>{chkR(r.snowshoe,T.success)}</div>
 </div>;})}
 <div style={{display:"grid",gridTemplateColumns:"1fr 2.2fr 2.8fr 1.3fr 5fr 1.3fr 1.3fr 1.3fr",gap:4,padding:"8px 8px",alignItems:"center",background:T.accent+"08",borderTop:`2px solid ${T.accent}30`}}>
 <div style={{fontSize:9,fontWeight:700,color:T.accent,textAlign:"center"}}>Σ</div>
 <div style={{fontSize:8,color:T.textMuted,textAlign:"center"}}>{spans.length}</div>
 <div style={{fontSize:13,fontWeight:700,color:T.accent,fontFamily:"monospace",textAlign:"center"}}>{j.production.totalFeet?.toLocaleString()}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.warning,textAlign:"center"}}>{j.production.anchors||""}</div>
 <div style={{fontSize:9,color:T.textMuted,textAlign:"center"}}>{j.production.entries||spans.filter(s=>s.strandSpan||s.fiberMarking).length} entries</div>
 <div style={{fontSize:9,fontWeight:700,color:T.cyan,textAlign:"center"}}>{j.production.coils||""}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.orange,textAlign:"center"}}>{j.production.poleTransfers||""}</div>
 <div style={{fontSize:9,fontWeight:700,color:T.success,textAlign:"center"}}>{j.production.snowshoes||""}</div>
 </div>
 </>;
 })()}
 {j.production.comments&&<div style={{margin:"0 12px 12px",padding:10,background:T.bgInput,borderRadius:6,borderLeft:`3px solid ${T.warning}`}}>
 <div style={{fontSize:10,fontWeight:600,color:T.warning,marginBottom:3}}>LINEMAN COMMENTS</div><div style={{fontSize:12,color:T.text}}>{j.production.comments}</div>
 </div>}
 </Card>
 </>}

 <Card style={{marginBottom:16}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:16}}>{isRS?"Your Redline Submissions":"Redline Files"}</h3>
 {j.redlines?.length>0?<div style={{display:"flex",flexDirection:"column",gap:10}}>
 {j.redlines.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:12,background:T.bgInput,borderRadius:4}}>
 <span style={{fontSize:22}}></span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{r.fileName}</div><div style={{fontSize:11,color:T.textMuted}}>v{r.version} · {fd(r.uploadedAt)} · {r.notes}</div></div>
 <Btn v="outline" sz="sm">View</Btn>
 </div>)}
 </div>:<p style={{color:T.textDim,fontSize:13}}>No redlines uploaded yet.</p>}
 </Card>
 {isRS&&(j.redlineStatus!=="Approved"&&j.redlineStatus!=="Under Review"&&j.redlineStatus!=="Uploaded")&&<Card>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:12}}>{j.redlineStatus==="Rejected"?"Upload Corrected Redline":"Upload Redline"}</h3>

 {/* Confirming totals — RS must input these */}
 {j.production&&(()=>{
 if(isUG){
 // Underground: per ground type with billing codes
 const gtColors={Normal:T.cyan,Cobble:T.warning,Rock:T.danger};
 const days=j.production.days||[];
 const ftByGT={Normal:0,Cobble:0,Rock:0};
 days.forEach(d=>{const gt=d.groundType||"Normal";ftByGT[gt]=(ftByGT[gt]||0)+(d.conduitFeet||0);});
 const gk=`${j.client}|${j.customer}|${j.region}`;const grp=rateCards[gk];
 const gtCodeMap={"Normal":"DB-Normal","Cobble":"DB-Cobble","Rock":"DB-Rock"};
 const fields=GROUND_TYPES.map(gt=>{
 const mapsTo=gtCodeMap[gt];const codeObj=grp?.codes?.find(c=>c.mapsTo===mapsTo);
 const kMap={Normal:"dbNormal",Cobble:"dbCobble",Rock:"dbRock"};
 return{k:kMap[gt],label:`${codeObj?.code||"—"} · ${gt}`,lm:ftByGT[gt],c:gtColors[gt],code:codeObj?.code};
 });
 return <div style={{marginBottom:16}}>
 <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Confirming Totals</div>
 <p style={{fontSize:11,color:T.textMuted,marginBottom:10}}>Verify the foreman's bore footage by ground type. These map to billing codes.</p>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
 {fields.map(f=><div key={f.k} style={{marginBottom:8}}>
 <label style={{fontSize:11,fontWeight:600,color:f.c,display:"block",marginBottom:3}}>{f.label} <span style={{color:T.textDim,fontWeight:400}}>(foreman: {f.lm} ft)</span></label>
 <input type="number" value={ct[f.k]} onChange={e=>setCt({...ct,[f.k]:e.target.value})} placeholder={String(f.lm)}
 style={{width:"100%",boxSizing:"border-box",padding:"8px 12px",fontSize:14,background:T.bgInput,color:T.text,border:`1px solid ${f.lm>0?f.c+"44":T.border}`,borderRadius:4,outline:"none"}}/>
 </div>)}
 </div>
 </div>;
 }
 // Aerial: production sheet totals by type
 const spans=j.production.spans||[];
 const lmSF=spans.filter(r=>(r.spanWorkType||"S+F")!=="Overlash").reduce((s,r)=>s+(r.strandSpan||0),0);
 const lmOVL=spans.filter(r=>(r.spanWorkType||"S+F")==="Overlash").reduce((s,r)=>s+(r.strandSpan||0),0);
 const fields=[
 {k:"strand",label:"Strand Footage (S+F)",lm:lmSF,c:T.cyan},
 {k:"fiber",label:"Fiber Footage (S+F)",lm:lmSF,c:T.purple},
 {k:"overlash",label:"Overlash Footage",lm:lmOVL,c:T.warning},
 {k:"anchors",label:"Anchors",lm:j.production.anchors||0,c:T.textMuted},
 {k:"coils",label:"Coils",lm:j.production.coils||0,c:T.textMuted},
 {k:"snowshoes",label:"Snowshoes",lm:j.production.snowshoes||0,c:T.textMuted},
 {k:"poleTransfers",label:"Pole Transfers",lm:j.production.poleTransfers||0,c:T.textMuted},
 ];
 return <div style={{marginBottom:16}}>
 <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Confirming Totals</div>
 <p style={{fontSize:11,color:T.textMuted,marginBottom:10}}>Verify the lineman's production numbers. These become the official totals for billing.</p>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
 {fields.map(f=><div key={f.k} style={{marginBottom:8}}>
 <label style={{fontSize:11,fontWeight:600,color:f.c,display:"block",marginBottom:3}}>{f.label} <span style={{color:T.textDim,fontWeight:400}}>(lineman: {f.lm})</span></label>
 <input type="number" value={ct[f.k]} onChange={e=>setCt({...ct,[f.k]:e.target.value})} placeholder={String(f.lm)}
 style={{width:"100%",boxSizing:"border-box",padding:"8px 12px",fontSize:14,background:T.bgInput,color:T.text,border:`1px solid ${f.lm>0?f.c+"44":T.border}`,borderRadius:4,outline:"none"}}/>
 </div>)}
 </div>
 </div>;
 })()}

 <div style={{padding:24,border:`2px dashed ${j.redlineStatus==="Rejected"?T.danger:T.border}`,borderRadius:4,textAlign:"center",marginBottom:12}}>
 <div style={{fontSize:32,marginBottom:8}}></div><div style={{fontSize:13,color:T.textMuted}}>{j.redlineStatus==="Rejected"?"Upload your corrected redline":"Click or drag to upload redline PDF"}</div><div style={{fontSize:11,color:T.textDim,marginTop:4}}>PDF, PNG, or JPEG accepted</div>
 </div>
 <Inp label="Notes" value={rn} onChange={setRn} ph={j.redlineStatus==="Rejected"?"Describe what you fixed...":"Correction notes..."}/>
 <div style={{display:"flex",gap:10}}><Btn onClick={upRL}>{j.redlineStatus==="Rejected"?"Upload Fix":"Upload Redline"}</Btn></div>
 </Card>}
 {isRS&&j.redlineStatus==="Uploaded"&&j.redlines?.length>0&&<Card style={{marginTop:16,borderLeft:`3px solid ${T.success}`,padding:14}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div><div style={{fontSize:14,fontWeight:700,color:T.text}}>Redline uploaded — ready to send?</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Submit for client review when your redline and confirmed totals are final.</div></div>
 <Btn v="success" onClick={subRev}>Submit for Client Review</Btn>
 </div>
 </Card>}

 {/* Confirmed vs Original comparison — visible when confirmed */}
 {j.confirmedTotals&&<Card style={{marginTop:16,borderLeft:`3px solid ${T.cyan}`}}>
 <div style={{fontSize:12,fontWeight:700,color:T.cyan,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Confirmed vs Original Production</div>
 {(()=>{
 const ct=j.confirmedTotals;
 const spans=j.production?.spans||[];
 const lmSF=spans.filter(r=>(r.spanWorkType||"S+F")!=="Overlash").reduce((s,r)=>s+(r.strandSpan||0),0);
 const lmOVL=spans.filter(r=>(r.spanWorkType||"S+F")==="Overlash").reduce((s,r)=>s+(r.strandSpan||0),0);
 const fields=[
 {l:"Strand (S+F)",orig:lmSF,conf:ct.totalStrand||0,c:T.cyan},
 {l:"Fiber (S+F)",orig:lmSF,conf:ct.totalFiber||ct.totalStrand||0,c:T.purple},
 {l:"Overlash",orig:lmOVL,conf:ct.totalOverlash||0,c:T.warning},
 {l:"Anchors",orig:j.production?.anchors||0,conf:ct.anchors||0,c:T.textMuted},
 {l:"Coils",orig:j.production?.coils||0,conf:ct.coils||0,c:T.textMuted},
 {l:"Snowshoes",orig:j.production?.snowshoes||0,conf:ct.snowshoes||0,c:T.textMuted},
 ].filter(f=>f.orig>0||f.conf>0);
 return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:8}}>
 {fields.map(f=>{const diff=f.conf!==f.orig;return <div key={f.l} style={{padding:8,background:diff?T.warningSoft:T.bgInput,borderRadius:6,border:diff?`1px solid ${T.warning}33`:`1px solid ${f.c}22`,borderTop:`2px solid ${f.c}`}}>
 <div style={{fontSize:10,color:f.c,fontWeight:600}}>{f.l}</div>
 <div style={{fontSize:15,fontWeight:700,color:diff?T.warning:T.text}}>{f.conf}{diff&&<span style={{fontSize:10,color:T.textDim,marginLeft:4}}>was {f.orig}</span>}</div>
 </div>;})}
 </div>;
 })()}
 <div style={{fontSize:10,color:T.textDim,marginTop:8}}>Confirmed by {USERS.find(u=>u.id===j.confirmedTotals.confirmedBy)?.name||"RS"} · {fdt(j.confirmedTotals.confirmedAt)}</div>
 </Card>}
 {!isRS&&j.reviewNotes&&<Card style={{marginTop:16,borderLeft:`3px solid ${T.danger}`}}>
 <div style={{fontSize:11,fontWeight:600,color:T.danger,marginBottom:4}}>REJECTION NOTES</div><div style={{fontSize:13,color:T.text,lineHeight:1.5}}>{j.reviewNotes}</div>
 </Card>}
 </div>}

 {tab==="review"&&<div>
 <Card style={{marginBottom:16}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:12}}>Review Status</h3>
 {FR("Job Status",j.status)}{FR("Redline Status",j.redlineStatus)}{FR("SR Number",j.srNumber)}
 </Card>
 {(isCR||isAdm)&&j.status==="Under Client Review"&&<Card>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:16}}>Review Actions</h3>
 <div style={{display:"flex",gap:10,marginBottom:16}}>
 <Btn v={ra==="approve"?"success":"outline"} onClick={()=>setRa("approve")}> Approve</Btn>
 <Btn v={ra==="reject"?"danger":"outline"} onClick={()=>setRa("reject")}>Reject</Btn>
 </div>
 {ra==="approve"&&<div><Inp label="SR Number (Required)" value={sri} onChange={setSri} ph="e.g. 1234567"/><Btn v="success" onClick={appJ} disabled={!sri}>Confirm Approval + Assign SR</Btn></div>}
 {ra==="reject"&&<div><Inp label="Rejection Notes (Required)" textarea value={rjn} onChange={setRjn} ph="Describe fixes needed..."/><Btn v="danger" onClick={rejJ} disabled={!rjn}>Confirm Rejection</Btn></div>}
 </Card>}
 {isAdm&&j.status==="Ready to Invoice"&&<Card style={{marginTop:16}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:8}}>Billing</h3>
 <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
 {[{l:"SR Number",ok:!!j.srNumber,v:j.srNumber},{l:"Redline Approved",ok:j.redlineStatus==="Approved",v:j.redlineStatus},{l:"Confirmed Totals",ok:!!j.confirmedTotals,v:j.confirmedTotals?"Yes":"No"},{l:"Financials",ok:fin.status==="Calculated",v:fin.status}].map(c=>
 <div key={c.l} style={{flex:1,padding:12,background:c.ok?T.successSoft:T.dangerSoft,borderRadius:4,minWidth:140}}>
 <div style={{fontSize:11,color:c.ok?T.success:T.danger,fontWeight:600}}>{c.ok?"":"×"} {c.l}</div><div style={{fontSize:14,fontWeight:700,color:T.text,marginTop:2}}>{c.v}</div>
 </div>)}
 </div>
 {!j.billedAt&&<Btn v="success" style={{marginTop:14}} onClick={()=>upd({status:"Billed",billedAt:new Date().toISOString()},{action:"billed",detail:"Marked as billed. Invoice sent.",from:"Ready to Invoice",to:"Billed"})}>Mark as Billed</Btn>}
 {j.billedAt&&<Badge label={`Billed ${fd(j.billedAt)}`} color={T.success} bg={T.successSoft}/>}
 </Card>}
 {isAdm&&j.status==="Billed"&&<Card style={{marginTop:16,borderLeft:`3px solid ${T.money}`,padding:14}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <span style={{fontSize:20}}></span>
 <div><div style={{fontSize:14,fontWeight:700,color:T.success}}>Billed</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Invoice sent on {fd(j.billedAt)}</div></div>
 </div>
 </Card>}
 </div>}

 {tab==="financials"&&canFin&&<div>
 {fin.status==="Calculated"&&fin.totals?<>
 <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:20}}>
 <SC label="NextGen Revenue" value={$(fin.totals.nextgenRevenue)} color={T.money} icon="$"/>
 <SC label="Lineman Pay" value={$(fin.totals.linemanPay)} color={T.accent} icon="$"/>
 <SC label="Investor Comm" value={$(fin.totals.investorCommission)} color={T.purple} icon="$"/>
 <SC label="Profit" value={$(fin.totals.profit)} color={T.success} icon="$" sub={`${pc(fin.totals.margin)} margin`}/>
 </div>
 <Card style={{marginBottom:16,padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Rate Resolution</div>
 <div style={{display:"flex",gap:20,fontSize:12,color:T.text,flexWrap:"wrap"}}>
 <span>Group: <b style={{color:T.accent}}>{j.client} | {j.customer} | {j.region}</b></span>
 <span>NG Profile: <b style={{color:T.success}}>Default</b></span>
 <span>LM Profile: <b style={{color:T.accent}}>{lm?.name||"—"}</b></span>
 <span>IV Profile: <b style={{color:T.purple}}>{j.truckInvestor||"—"}</b></span>
 </div>
 </Card>
 <Card>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Calculation Breakdown</h3>
 <DT columns={[
 {key:"code",label:"Code",render:r=><span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:T.accent}}>{r.code}</span>},
 {key:"description",label:"Desc"},{key:"qty",label:"Qty",render:r=><b>{r.qty}</b>},
 {key:"u",label:"Unit",render:r=><span style={{fontSize:11,color:T.textMuted}}>{r.unit}</span>},
 {key:"nr",label:"NG Rate",render:r=><span style={{color:T.success}}>${r.nextgenRate?.toFixed(2)}</span>},
 {key:"lr",label:"LM Rate",render:r=><span style={{color:T.accent}}>{r.linemanRate!=null?`$${r.linemanRate.toFixed(2)}`:"—"}</span>},
 {key:"ir",label:"IV Rate",render:r=><span style={{color:T.purple}}>{r.investorRate!=null?`$${r.investorRate.toFixed(2)}`:"—"}</span>},
 {key:"na",label:"NG Amt",render:r=><b style={{color:T.success}}>{$(r.nextgenAmount)}</b>},
 {key:"la",label:"LM Amt",render:r=><span style={{color:T.accent}}>{$(r.linemanAmount)}</span>},
 {key:"ia",label:"IV Amt",render:r=><span style={{color:T.purple}}>{$(r.investorAmount)}</span>},
 ]} data={fin.items}/>
 <div style={{display:"flex",justifyContent:"flex-end",gap:24,marginTop:14,padding:"12px 14px",background:T.bgInput,borderRadius:4}}>
 <span style={{fontSize:13}}>Revenue: <b style={{color:T.success}}>{$(fin.totals.nextgenRevenue)}</b></span>
 <span style={{fontSize:13}}>Pay: <b style={{color:T.accent}}>{$(fin.totals.linemanPay)}</b></span>
 <span style={{fontSize:13}}>Comm: <b style={{color:T.purple}}>{$(fin.totals.investorCommission)}</b></span>
 <span style={{fontSize:13}}>Profit: <b style={{color:T.success}}>{$(fin.totals.profit)}</b> ({pc(fin.totals.margin)})</span>
 </div>
 </Card>
 </>
 :<Card style={{borderLeft:`3px solid ${fin.status==="No Production"?T.textDim:T.danger}`}}>
 <div style={{display:"flex",alignItems:"center",gap:12,padding:8}}>
 <FB status={fin.status}/>
 <div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{fin.status==="No Production"?"Awaiting production submission":"Rate resolution failed"}</div>
 {fin.error&&<div style={{fontSize:12,color:T.danger,marginTop:2}}>{fin.error}</div>}
 </div>
 </div>
 </Card>}
 </div>}

 {/* ── CHAT TAB ── */}
 {tab==="chat"&&<div>
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,margin:0}}>Job Chat</h3>
 <span style={{fontSize:11,color:T.textMuted}}>{(j.messages||[]).length} message{(j.messages||[]).length!==1?"s":""}</span>
 </div>
 <div style={{padding:16,maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,minHeight:200}}>
 {(j.messages||[]).length===0&&<div style={{textAlign:"center",padding:40,color:T.textDim,fontSize:13}}>No messages yet. Start the conversation.</div>}
 {(j.messages||[]).map(m=>{
 const isMe=m.userId===currentUser.id;const u=USERS.find(u=>u.id===m.userId);
 return <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",maxWidth:"80%",alignSelf:isMe?"flex-end":"flex-start"}}>
 <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
 <div style={{width:20,height:20,borderRadius:5,background:`linear-gradient(135deg,${T.accent}55,${T.purple}55)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:T.accent}}>
 {u?.name.split(" ").map(n=>n[0]).join("")||"?"}
 </div>
 <span style={{fontSize:11,fontWeight:600,color:T.textMuted}}>{u?.name||"Unknown"}</span>
 <span style={{fontSize:10,color:T.textDim}}>{u?.role?.replace("_"," ")}</span>
 </div>
 <div style={{padding:"10px 14px",borderRadius:12,background:isMe?T.chatMe:T.chatThem,
 borderTopRightRadius:isMe?3:12,borderTopLeftRadius:isMe?12:3,fontSize:13,color:T.text,lineHeight:1.5}}>
 {m.text}
 </div>
 <span style={{fontSize:9,color:T.textDim,marginTop:2}}>{fdt(m.ts)}</span>
 </div>;
 })}
 </div>
 <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
 <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} placeholder="Type a message..." onKeyDown={e=>{if(e.key==="Enter")sendChat();}}
 style={{flex:1,padding:"10px 14px",fontSize:14,background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4,outline:"none"}}/>
 <button onClick={sendChat} disabled={!chatMsg.trim()} style={{padding:"10px 18px",borderRadius:4,border:"none",background:chatMsg.trim()?T.accent:T.bgInput,color:chatMsg.trim()?"#fff":T.textDim,fontWeight:700,fontSize:13,cursor:chatMsg.trim()?"pointer":"not-allowed",transition:"all 0.15s"}}>Send</button>
 </div>
 </Card>
 </div>}

 {/* ── DOCUMENTS VAULT TAB ── */}
 {tab==="documents"&&<div>
 <Card style={{padding:0,overflow:"hidden"}}>
 {/* Header with upload button */}
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
  <div>
   <h3 style={{fontSize:14,fontWeight:700,color:T.text,margin:0}}>Document Vault</h3>
   <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{(j.documents||[]).length} document{(j.documents||[]).length!==1?"s":""}
   {(j.documents||[]).filter(d=>d.status==="expired").length>0&&<span style={{color:T.danger,fontWeight:600}}> · {(j.documents||[]).filter(d=>d.status==="expired").length} expired</span>}
   {(j.documents||[]).filter(d=>d.status==="pending").length>0&&<span style={{color:T.warning,fontWeight:600}}> · {(j.documents||[]).filter(d=>d.status==="pending").length} pending</span>}
   </div>
  </div>
  <Btn sz="sm" onClick={()=>setDocUpload(!docUpload)}>{docUpload?"Cancel":"+ Upload Document"}</Btn>
 </div>

 {/* Upload form */}
 {docUpload&&<div style={{padding:"16px 18px",borderBottom:`1px solid ${T.border}`,background:T.accentSoft}}>
  <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:12,textTransform:"uppercase",letterSpacing:0.5}}>New Document</div>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
   <div>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:4,fontWeight:600}}>Document Type</div>
    <select value={newDoc.type} onChange={e=>setNewDoc({...newDoc,type:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>
     {DOC_TYPES.map(dt=><option key={dt.key} value={dt.key}>{dt.label}</option>)}
    </select>
   </div>
   <div>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:4,fontWeight:600}}>File Name</div>
    <input value={newDoc.name} onChange={e=>setNewDoc({...newDoc,name:e.target.value})} placeholder={`e.g. Permit_${j.feederId}.pdf`} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}/>
   </div>
   {(newDoc.type==="permit"||newDoc.type==="easement")&&<div>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:4,fontWeight:600}}>Expiration Date</div>
    <input type="date" value={newDoc.expires} onChange={e=>setNewDoc({...newDoc,expires:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}/>
   </div>}
   <div style={{gridColumn:(newDoc.type==="permit"||newDoc.type==="easement")?"2":"1 / -1"}}>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:4,fontWeight:600}}>Notes</div>
    <input value={newDoc.notes} onChange={e=>setNewDoc({...newDoc,notes:e.target.value})} placeholder="Optional notes about this document..." style={{width:"100%",padding:"8px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}/>
   </div>
  </div>
  {/* Simulated file drop zone */}
  <div style={{marginTop:10,padding:"20px 16px",border:`2px dashed ${T.border}`,borderRadius:8,textAlign:"center",cursor:"pointer",transition:"all 0.15s"}}
   onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.background=T.accentSoft;}}
   onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="transparent";}}>
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="1.5" style={{margin:"0 auto 6px"}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
   <div style={{fontSize:12,color:T.textMuted}}>Drop file here or click to browse</div>
   <div style={{fontSize:10,color:T.textDim,marginTop:3}}>PDF, JPG, PNG, ZIP · Max 25 MB</div>
  </div>
  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
   <Btn v="ghost" sz="sm" onClick={()=>{setDocUpload(false);setNewDoc({type:"permit",name:"",notes:"",expires:""});}}>Cancel</Btn>
   <Btn sz="sm" onClick={()=>{
    if(!newDoc.name.trim())return;
    const doc={id:`doc-${j.id}-${Date.now()}`,type:newDoc.type,name:newDoc.name.trim(),status:newDoc.type==="safety"?"pending":"current",uploadedAt:new Date().toISOString(),uploadedBy:currentUser.id,uploadedByName:currentUser.name,fileSize:"—",notes:newDoc.notes,expires:newDoc.expires||undefined};
    upd({documents:[...(j.documents||[]),doc]},{action:"document_uploaded",detail:`Document uploaded: ${DOC_TYPES.find(d=>d.key===newDoc.type)?.label||newDoc.type} — ${newDoc.name.trim()}`});
    setNewDoc({type:"permit",name:"",notes:"",expires:""});setDocUpload(false);
   }}>Upload Document</Btn>
  </div>
 </div>}

 {/* Filter bar */}
 {(j.documents||[]).length>0&&<div style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
  <button onClick={()=>setDocFilter("all")} style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:docFilter==="all"?`1.5px solid ${T.accent}`:`1px solid ${T.border}`,background:docFilter==="all"?T.accentSoft:"transparent",color:docFilter==="all"?T.accent:T.textMuted}}>All ({(j.documents||[]).length})</button>
  {DOC_TYPES.filter(dt=>(j.documents||[]).some(d=>d.type===dt.key)).map(dt=>{
   const count=(j.documents||[]).filter(d=>d.type===dt.key).length;
   return <button key={dt.key} onClick={()=>setDocFilter(docFilter===dt.key?"all":dt.key)} style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:docFilter===dt.key?`1.5px solid ${T.accent}`:`1px solid ${T.border}`,background:docFilter===dt.key?T.accentSoft:"transparent",color:docFilter===dt.key?T.accent:T.textMuted}}>{dt.label} ({count})</button>;
  })}
  <div style={{flex:1}}/>
  <input value={docSearch} onChange={e=>setDocSearch(e.target.value)} placeholder="Search documents..." style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11,width:160}}/>
 </div>}

 {/* Document list */}
 <div>
  {(j.documents||[]).length===0&&!docUpload&&<div style={{padding:50,textAlign:"center"}}>
   <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="1.2" style={{margin:"0 auto 12px",opacity:0.5}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
   <div style={{fontSize:14,fontWeight:600,color:T.textDim,marginBottom:4}}>No documents yet</div>
   <div style={{fontSize:12,color:T.textDim}}>Upload permits, easements, JHAs, completion forms, and more.</div>
  </div>}

  {(()=>{
   let filtered=(j.documents||[]);
   if(docFilter!=="all")filtered=filtered.filter(d=>d.type===docFilter);
   if(docSearch.trim())filtered=filtered.filter(d=>d.name.toLowerCase().includes(docSearch.toLowerCase())||d.notes?.toLowerCase().includes(docSearch.toLowerCase())||(DOC_TYPES.find(dt=>dt.key===d.type)?.label||"").toLowerCase().includes(docSearch.toLowerCase()));
   // Sort: expired first (attention needed), then by upload date desc
   filtered=[...filtered].sort((a,b)=>{if(a.status==="expired"&&b.status!=="expired")return -1;if(b.status==="expired"&&a.status!=="expired")return 1;return new Date(b.uploadedAt)-new Date(a.uploadedAt);});
   if(filtered.length===0&&(j.documents||[]).length>0)return <div style={{padding:30,textAlign:"center",color:T.textDim,fontSize:13}}>No documents match your filter.</div>;
   return filtered.map(doc=>{
    const dt=DOC_TYPES.find(t=>t.key===doc.type)||{label:"Other",icon:"…"};
    const stCfg=DOC_STATUS_CFG[doc.status]||DOC_STATUS_CFG.current;
    const isExpired=doc.expires&&new Date(doc.expires)<new Date();
    const daysToExpiry=doc.expires?Math.ceil((new Date(doc.expires)-new Date())/(86400000)):null;
    const expiringSoon=daysToExpiry!==null&&daysToExpiry>0&&daysToExpiry<=30;
    return <div key={doc.id} style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}08`,display:"flex",gap:12,alignItems:"flex-start",transition:"all 0.12s"}}
     className="card-hover">
     {/* Type icon */}
     <div style={{width:36,height:36,borderRadius:6,background:isExpired?T.dangerSoft:stCfg.bg,border:`1.5px solid ${isExpired?T.danger+"40":stCfg.c+"30"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:isExpired?T.danger:stCfg.c,flexShrink:0}}>{dt.icon}</div>
     {/* Content */}
     <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
       <span style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</span>
       <span style={{fontSize:10,fontWeight:600,color:stCfg.c,padding:"2px 7px",borderRadius:3,background:stCfg.bg,textTransform:"uppercase",letterSpacing:0.3}}>{isExpired?"EXPIRED":stCfg.label}</span>
       {expiringSoon&&<span style={{fontSize:10,fontWeight:600,color:T.warning,padding:"2px 7px",borderRadius:3,background:T.warningSoft}}>Expires in {daysToExpiry}d</span>}
      </div>
      <div style={{display:"flex",gap:12,marginTop:4,fontSize:11,color:T.textMuted,flexWrap:"wrap"}}>
       <span style={{fontWeight:600,color:T.accent}}>{dt.label}</span>
       <span>{doc.uploadedByName}</span>
       <span>{new Date(doc.uploadedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
       {doc.fileSize&&<span>{doc.fileSize}</span>}
       {doc.expires&&<span style={{color:isExpired?T.danger:expiringSoon?T.warning:T.textDim}}>Exp: {doc.expires}</span>}
      </div>
      {doc.notes&&<div style={{fontSize:11,color:T.textDim,marginTop:4,lineHeight:1.4}}>{doc.notes}</div>}
     </div>
     {/* Actions */}
     <div style={{display:"flex",gap:4,flexShrink:0}}>
      <button title="View" style={{width:28,height:28,borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:T.textMuted,fontSize:12,transition:"all 0.12s"}}
       onMouseEnter={e=>{e.currentTarget.style.background=T.accent;e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor=T.accent;}}
       onMouseLeave={e=>{e.currentTarget.style.background=T.bgInput;e.currentTarget.style.color=T.textMuted;e.currentTarget.style.borderColor=T.border;}}>
       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      {isAdm&&<button title="Remove" onClick={(e)=>{e.stopPropagation();upd({documents:(j.documents||[]).filter(d=>d.id!==doc.id)},{action:"document_removed",detail:`Document removed: ${dt.label} — ${doc.name}`});}} style={{width:28,height:28,borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:T.textMuted,fontSize:12,transition:"all 0.12s"}}
       onMouseEnter={e=>{e.currentTarget.style.background=T.dangerSoft;e.currentTarget.style.color=T.danger;e.currentTarget.style.borderColor=T.danger+"44";}}
       onMouseLeave={e=>{e.currentTarget.style.background=T.bgInput;e.currentTarget.style.color=T.textMuted;e.currentTarget.style.borderColor=T.border;}}>
       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>}
     </div>
    </div>;
   });
  })()}
 </div>

 {/* Document checklist — what's missing for this job */}
 {isAdm&&<div style={{padding:"14px 18px",borderTop:`1px solid ${T.border}`,background:T.accentSoft+"44"}}>
  <div style={{fontSize:11,fontWeight:700,color:T.accent,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Document Checklist</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))",gap:6}}>
   {[
    {type:"permit",required:true},
    {type:"make_ready",required:j.department==="aerial"},
    {type:"safety",required:true},
    {type:"completion",required:["Ready to Invoice","Billed"].includes(j.status)},
    {type:"as_built",required:j.status==="Billed"},
    {type:"easement",required:false},
   ].map(chk=>{
    const dt=DOC_TYPES.find(t=>t.key===chk.type);
    const has=(j.documents||[]).some(d=>d.type===chk.type);
    const isExp=(j.documents||[]).filter(d=>d.type===chk.type).some(d=>d.expires&&new Date(d.expires)<new Date());
    return <div key={chk.type} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:has?(isExp?T.dangerSoft:T.successSoft):chk.required?T.warningSoft:"transparent",border:`1px solid ${has?(isExp?T.danger+"30":T.success+"30"):chk.required?T.warning+"30":T.border}`}}>
     <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${has?(isExp?T.danger:T.success):chk.required?T.warning:T.textDim}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:has?isExp?T.danger:T.success:chk.required?T.warning:T.textDim,background:has?(isExp?T.dangerSoft:T.successSoft):"transparent"}}>{has?(isExp?"!":"✓"):"—"}</div>
     <div>
      <div style={{fontSize:11,fontWeight:600,color:has?T.text:chk.required?T.warning:T.textDim}}>{dt?.label}</div>
      <div style={{fontSize:9,color:has?(isExp?T.danger:T.success):chk.required?T.warning:T.textDim}}>{has?(isExp?"Expired — renew":"Uploaded"):chk.required?"Missing":"Optional"}</div>
     </div>
    </div>;
   })}
  </div>
 </div>}
 </Card>
 </div>}

 {/* ── ACTIVITY / AUDIT TRAIL TAB ── */}
 {tab==="activity"&&<div>
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <h3 style={{fontSize:14,fontWeight:700,color:T.text,margin:0}}>Activity Log</h3>
 <span style={{fontSize:11,color:T.textMuted}}>{(j.auditLog||[]).length} event{(j.auditLog||[]).length!==1?"s":""}</span>
 </div>
 <div style={{padding:"16px 18px"}}>
 {(j.auditLog||[]).length===0&&<div style={{textAlign:"center",padding:40,color:T.textDim,fontSize:13}}>No activity recorded yet.</div>}
 {[...(j.auditLog||[])].reverse().map((e,i)=>{
 const ACFG={job_created:{icon:"＋",color:T.textMuted},assigned:{icon:"→",color:T.accent},production_submitted:{icon:"▲",color:T.cyan},redline_uploaded:{icon:"◆",color:T.purple},submitted_for_review:{icon:"◈",color:T.warning},approved:{icon:"✓",color:T.success},rejected:{icon:"✕",color:T.danger},billed:{icon:"$",color:T.money},status_change:{icon:"○",color:T.textMuted}};
 const cfg=ACFG[e.action]||ACFG.status_change;
 const isLast=i===(j.auditLog||[]).length-1;
 return <div key={i} style={{display:"flex",gap:14,position:"relative",paddingBottom:isLast?0:20}}>
 {/* Timeline connector */}
 {!isLast&&<div style={{position:"absolute",left:15,top:32,bottom:0,width:2,background:`${T.border}66`}}/>}
 {/* Icon */}
 <div style={{width:32,height:32,borderRadius:4,background:cfg.color+"14",border:`1.5px solid ${cfg.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:cfg.color,flexShrink:0,zIndex:1}}>{cfg.icon}</div>
 {/* Content */}
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
 <span style={{fontSize:13,fontWeight:600,color:T.text}}>{e.actorName||"System"}</span>
 <span style={{fontSize:11,fontWeight:600,color:cfg.color,textTransform:"uppercase",letterSpacing:0.3}}>{(e.action||"").replace(/_/g," ")}</span>
 {e.from&&e.to&&<span style={{fontSize:10,color:T.textDim,display:"flex",alignItems:"center",gap:3}}>
 <span style={{padding:"1px 5px",borderRadius:3,background:T.bgInput,fontWeight:600}}>{e.from}</span>
 <span>→</span>
 <span style={{padding:"1px 5px",borderRadius:3,background:cfg.color+"14",color:cfg.color,fontWeight:600}}>{e.to}</span>
 </span>}
 </div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:3,lineHeight:1.5}}>{e.detail}</div>
 <div style={{fontSize:10,color:T.textDim,marginTop:4,fontFamily:"monospace"}}>{e.ts?new Date(e.ts).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"—"}</div>
 </div>
 </div>;
 })}
 </div>
 </Card>
 </div>}
 </div>;
}
function PayrollView(){
 const{jobs,rateCards,paidStubs,setPaidStubs,payrollRuns,setPayrollRuns,bankAccounts,trucks}=useApp();
 const linemen=USERS.filter(u=>u.role==="lineman");
 const foremen=USERS.filter(u=>u.role==="foreman");
 const supervisors=USERS.filter(u=>u.role==="supervisor");
 const investors=USERS.filter(u=>u.role==="truck_investor"||u.role==="drill_investor");
 const weeks=useMemo(getPayableWeeks,[]);
 const[selWeek,setSelWeek]=useState(weeks[0]||"");
 const[selLM,setSelLM]=useState(null);
 const[processing,setProcessing]=useState(false);
 const[tab,setTab]=useState("linemen");

 // Lineman stubs
 const lmStubs=useMemo(()=>{
 if(!selWeek)return[];
 return linemen.map(lm=>{
 const lmJobs=jobs.filter(j=>{
 if(j.assignedLineman!==lm.id||!j.production?.completedDate||j.department==="underground")return false;
 return payWeekKey(new Date(j.production.completedDate))===selWeek;
 });
 let totalPay=0;const details=[];
 const byType={};
 lmJobs.forEach(j=>{
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){
 totalPay+=f.totals.linemanPay;
 const jobItems=f.items.filter(i=>i.linemanAmount>0);
 details.push({job:j,items:jobItems,pay:f.totals.linemanPay});
 jobItems.forEach(item=>{
 if(!byType[item.description])byType[item.description]={desc:item.description,qty:0,rate:item.linemanRate,unit:item.unit,amount:0};
 byType[item.description].qty+=item.qty;
 byType[item.description].amount+=item.linemanAmount;
 });
 }
 });
 return{lm,jobs:lmJobs,details,byType:Object.values(byType),totalPay,paid:!!(paidStubs[`${lm.id}|${selWeek}`])};
 }).filter(s=>s.jobs.length>0);
 },[selWeek,jobs,rateCards,linemen,paidStubs]);

 // Foreman stubs
 const fmStubs=useMemo(()=>{
 if(!selWeek)return[];
 return foremen.map(fm=>{
 const fmJobs=jobs.filter(j=>j.assignedLineman===fm.id&&j.production?.completedDate&&j.department==="underground"&&payWeekKey(new Date(j.production.completedDate))===selWeek);
 let totalPay=0,fullDays=0,halfDays=0,conduitLt=0,conduitGt=0,totalFt=0;
 fmJobs.forEach(j=>{(j.production.days||[]).forEach(d=>{if(d.fullDay)fullDays++;if(d.halfDay)halfDays++;const ft=d.conduitFeet||0;totalFt+=ft;if(ft<=500)conduitLt+=ft;else conduitGt+=ft;});});
 totalPay=(fullDays*UG_PAY.fullDay)+(halfDays*UG_PAY.halfDay)+(conduitLt*UG_PAY.conduitLt)+(conduitGt*UG_PAY.conduitGt);
 if(totalFt>=UG_PAY.weeklyBonusThreshold)totalPay+=UG_PAY.weeklyBonus;
 return{lm:fm,jobs:fmJobs,totalPay,fullDays,halfDays,totalFt,hasBonus:totalFt>=UG_PAY.weeklyBonusThreshold,paid:!!(paidStubs[`${fm.id}|${selWeek}`])};
 }).filter(s=>s.jobs.length>0);
 },[selWeek,jobs,foremen,paidStubs]);

 // Supervisor stubs
 const svStubs=useMemo(()=>{
 if(!selWeek)return[];
 return supervisors.map(sv=>{
 const scope=sv.scope||{};
 const svJobs=jobs.filter(j=>j.customer===scope.customer&&j.region===scope.region&&j.production?.completedDate&&payWeekKey(new Date(j.production.completedDate))===selWeek);
 let totalRev=0;
 svJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals)totalRev+=f.totals.nextgenRevenue;});
 const commission=+(totalRev*(sv.commissionRate||0.03)).toFixed(2);
 const salary=sv.weeklySalary||1500;
 return{lm:sv,jobs:svJobs,totalPay:+(salary+commission).toFixed(2),salary,commission,paid:!!(paidStubs[`${sv.id}|${selWeek}`])};
 }).filter(s=>s.jobs.length>0||true);// always show supervisor even with 0 jobs (they get salary)
 },[selWeek,jobs,rateCards,supervisors,paidStubs]);

 // Investor stubs
 const invStubs=useMemo(()=>{
 if(!selWeek)return[];
 return investors.map(inv=>{
 const myAssets=inv.trucks||inv.drills||[];
 const invJobs=jobs.filter(j=>{
 if(!j.production?.completedDate)return false;
 if(payWeekKey(new Date(j.production.completedDate))!==selWeek)return false;
 return myAssets.includes(j.assignedTruck)||myAssets.includes(j.assignedDrill);
 });
 let totalPay=0;
 invJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals)totalPay+=f.totals.investorReturn||0;});
 return{lm:inv,jobs:invJobs,totalPay,paid:!!(paidStubs[`${inv.id}|${selWeek}`])};
 }).filter(s=>s.jobs.length>0);
 },[selWeek,jobs,rateCards,investors,paidStubs]);

 const allStubs=tab==="linemen"?lmStubs:tab==="foremen"?fmStubs:tab==="supervisors"?svStubs:invStubs;
 const allPayees=[...lmStubs,...fmStubs,...svStubs,...invStubs];
 const totalAll=allPayees.reduce((s,st)=>s+st.totalPay,0);
 const paidCount=allPayees.filter(s=>s.paid).length;
 const totalPayees=allPayees.length;
 const wn=selWeek?weekNumber(selWeek):0;
 const pd=selWeek?payDate(selWeek):null;
 const run=payrollRuns[selWeek];

 const togglePaid=(lmId)=>{const k=`${lmId}|${selWeek}`;setPaidStubs({...paidStubs,[k]:!paidStubs[k]});};

 const processPayroll=()=>{
 setProcessing(true);
 // Simulate processing delay
 setTimeout(()=>{
 const items=allPayees.map(s=>({userId:s.lm.id,name:s.lm.name,role:s.lm.role,amount:s.totalPay,status:"completed",paidAt:new Date().toISOString(),bankLast4:bankAccounts[s.lm.id]?.accountLast4||"N/A"}));
 const newPaid={...paidStubs};
 allPayees.forEach(s=>{newPaid[`${s.lm.id}|${selWeek}`]=true;});
 setPaidStubs(newPaid);
 setPayrollRuns({...payrollRuns,[selWeek]:{status:"completed",processedAt:new Date().toISOString(),processedBy:"Admin User",items,totalAmount:totalAll}});
 setProcessing(false);
 },2000);
 };

 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Payroll</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 16px"}}>Process and distribute weekly payments</p>

 <Card style={{marginBottom:16,padding:14}}>
 <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
 <Inp label="Pay Week" value={selWeek} onChange={v=>{setSelWeek(v);setSelLM(null);}} options={weeks.map(w=>({value:w,label:`Week ${weekNumber(w)} · ${payWeekLabel(w)}`}))} style={{marginBottom:0,minWidth:300}}/>
 <div style={{display:"flex",gap:16,padding:"8px 0",flexWrap:"wrap",alignItems:"center"}}>
 {selWeek&&<span style={{fontSize:13,fontWeight:700,color:T.accent}}>Week {wn}</span>}
 {pd&&<span style={{fontSize:12,color:T.textMuted}}>Pay Date: <b style={{color:T.text}}>{fd(pd)}</b></span>}
 <span style={{fontSize:13,color:T.text}}>Total: <b style={{color:T.success}}>{$(totalAll)}</b></span>
 <span style={{fontSize:13,color:T.textMuted}}>{totalPayees} payees</span>
 </div>
 </div>
 </Card>

 {/* Payroll processing card */}
 {selWeek&&<Card style={{marginBottom:16,padding:0,overflow:"hidden",borderColor:run?.status==="completed"?T.success+"44":T.accent+"44"}}>
 <div style={{padding:"16px 20px"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{fontSize:14,fontWeight:600,color:T.text}}>
 {run?.status==="completed"?"Payroll Processed":"Process Payroll — Week "+wn}
 </div>
 {run?.status==="completed"
 ?<div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Processed {fdt(run.processedAt)} · {run.items.length} payments · {$(run.totalAmount)} total</div>
 :<div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Review all payees below, then process to initiate direct deposits.</div>
 }
 </div>
 {run?.status==="completed"
 ?<Badge label="COMPLETED" color={T.success} bg={T.successSoft}/>
 :<Btn v="success" onClick={processPayroll} disabled={processing||totalPayees===0}>
 {processing?<span style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:14,height:14,border:`2px solid #fff`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Processing...</span>:"Process Payroll — "+$(totalAll)}
 </Btn>
 }
 </div>
 </div>

 {/* Payment summary bar */}
 <div style={{display:"flex",borderTop:`1px solid ${T.border}`}}>
 {[
 {label:"Linemen",count:lmStubs.length,amount:lmStubs.reduce((s,x)=>s+x.totalPay,0),color:T.cyan},
 {label:"Foremen",count:fmStubs.length,amount:fmStubs.reduce((s,x)=>s+x.totalPay,0),color:T.cyan},
 {label:"Supervisors",count:svStubs.length,amount:svStubs.reduce((s,x)=>s+x.totalPay,0),color:T.accent},
 {label:"Investors",count:invStubs.length,amount:invStubs.reduce((s,x)=>s+x.totalPay,0),color:T.orange},
 ].map((g,i)=><div key={i} style={{flex:1,padding:"10px 16px",textAlign:"center",borderRight:i<3?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:16,fontWeight:600,color:g.amount>0?T.success:T.textDim}}>{$(g.amount)}</div>
 <div style={{fontSize:10,color:T.textMuted}}>{g.count} {g.label}</div>
 </div>)}
 </div>
 </Card>}

 {/* Payee tabs */}
 <div style={{display:"flex",gap:4,marginBottom:16}}>
 {[{k:"linemen",l:"Linemen",n:lmStubs.length},{k:"foremen",l:"Foremen",n:fmStubs.length},{k:"supervisors",l:"Supervisors",n:svStubs.length},{k:"investors",l:"Investors",n:invStubs.length}].map(t=>
 <button key={t.k} onClick={()=>{setTab(t.k);setSelLM(null);}} style={{padding:"8px 16px",borderRadius:4,border:`1px solid ${tab===t.k?T.accent:T.border}`,background:tab===t.k?T.accentSoft:"transparent",color:tab===t.k?T.accent:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
 {t.l} <span style={{marginLeft:4,opacity:0.7}}>({t.n})</span>
 </button>
 )}
 </div>

 {selLM?(() => {
 const st=allStubs.find(s=>s.lm.id===selLM);
 if(!st)return <Card><p style={{color:T.textDim,textAlign:"center",padding:24}}>No data.</p></Card>;
 const hasBa=!!bankAccounts[st.lm.id];
 const ba=bankAccounts[st.lm.id];
 const workTypes=[...new Set((st.details||[]).flatMap(d=>d.items.map(i=>i.description)))];
 return <div>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
 <Btn v="ghost" sz="sm" onClick={()=>setSelLM(null)}>← Back</Btn>
 <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{st.lm.name} — Pay Stub</h2>
 {st.paid?<Badge label="PAID" color={T.success} bg={T.successSoft}/>:<Badge label="PENDING" color={T.warning} bg={T.warningSoft}/>}
 </div>

 {/* Payment info card */}
 <Card style={{marginBottom:14,padding:16,borderColor:hasBa?T.success+"33":T.danger+"33"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasBa?T.success:T.danger} strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>Direct Deposit</div>
 {hasBa
 ?<div style={{fontSize:12,color:T.textMuted}}>{ba.bank} · {ba.accountType} ····{ba.accountLast4}</div>
 :<div style={{fontSize:12,color:T.danger}}>No bank account on file</div>
 }
 </div>
 </div>
 {hasBa?<Badge label="Verified" color={T.success} bg={T.successSoft}/>:<Badge label="Setup Required" color={T.danger} bg={T.dangerSoft}/>}
 </div>
 </Card>

 <Card style={{marginBottom:14,padding:20,borderColor:T.accent+"44"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
 <div>
 <div style={{fontSize:20,fontWeight:600,color:T.text}}>Week {wn}</div>
 <div style={{fontSize:14,fontWeight:600,color:T.textMuted,marginTop:2}}>{payWeekLabel(selWeek)}</div>
 <div style={{fontSize:13,color:T.text,marginTop:8}}>{st.lm.role.replace("_"," ")}: <b>{st.lm.name}</b></div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Pay Date: <b style={{color:T.text}}>{fd(pd)}</b></div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Week Total</div>
 <div style={{fontSize:32,fontWeight:600,color:T.success,lineHeight:1.1}}>{$(st.totalPay)}</div>
 {st.byType&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:2,alignItems:"flex-end"}}>
 {st.byType.map((t,i)=><div key={i} style={{fontSize:11,color:T.textMuted}}>{t.desc}: <b style={{color:T.accent}}>{$(t.rate)}{t.unit==="per foot"?"/ft":"/ea"}</b></div>)}
 </div>}
 {st.salary!=null&&<div style={{marginTop:10,fontSize:11,color:T.textMuted}}>Salary: {$(st.salary)} + Commission: {$(st.commission)}</div>}
 </div>
 </div>
 </Card>

 {/* Per-job grid (linemen only) */}
 {st.details&&st.details.length>0&&<Card style={{marginBottom:14,padding:0,overflow:"hidden"}}>
 <div style={{overflowX:"auto"}}>
 <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
 <thead>
 <tr style={{background:T.bgInput}}>
 <th style={{textAlign:"left",padding:"10px 12px",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,position:"sticky",left:0,background:T.bgInput,zIndex:1}}>RUN / Project</th>
 <th style={{textAlign:"left",padding:"10px 8px",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>Date</th>
 {workTypes.map(wt=><th key={wt} style={{textAlign:"right",padding:"10px 8px",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{wt}</th>)}
 <th style={{textAlign:"right",padding:"10px 12px",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>Job Total</th>
 </tr>
 </thead>
 <tbody>
 {st.details.map((d,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
 <td style={{padding:"8px 12px",fontWeight:600,color:T.accent,fontFamily:"monospace",fontSize:11,whiteSpace:"nowrap",position:"sticky",left:0,background:T.bgCard,zIndex:1}}>{d.job.feederId}</td>
 <td style={{padding:"8px 8px",color:T.textMuted,fontSize:11}}>{fd(d.job.production?.completedDate)}</td>
 {workTypes.map(wt=>{const item=d.items.find(it=>it.description===wt);
 return <td key={wt} style={{textAlign:"right",padding:"8px 8px",color:item?T.text:T.textDim}}>{item?item.qty.toLocaleString():"—"}</td>;
 })}
 <td style={{textAlign:"right",padding:"8px 12px",fontWeight:700,color:T.success}}>{$(d.pay)}</td>
 </tr>)}
 </tbody>
 <tfoot>
 <tr style={{borderTop:`2px solid ${T.accent}`,background:T.bgInput}}>
 <td style={{padding:"10px 12px",fontWeight:700,color:T.text,position:"sticky",left:0,background:T.bgInput,zIndex:1}} colSpan={2}>TOTALS</td>
 {workTypes.map(wt=>{const t=st.byType.find(b=>b.desc===wt);
 return <td key={wt} style={{textAlign:"right",padding:"10px 8px"}}><div style={{fontWeight:700,color:T.text}}>{t?t.qty.toLocaleString():"0"}</div><div style={{fontWeight:700,color:T.success,fontSize:11}}>{$(t?.amount||0)}</div></td>;
 })}
 <td style={{textAlign:"right",padding:"10px 12px",fontWeight:600,color:T.success,fontSize:16}}>{$(st.totalPay)}</td>
 </tr>
 </tfoot>
 </table>
 </div>
 </Card>}

 <div style={{display:"flex",gap:10,marginTop:14}}>
 {!st.paid&&<Btn v="success" onClick={()=>togglePaid(st.lm.id)}>Mark as Paid</Btn>}
 {st.paid&&<Btn v="outline" onClick={()=>togglePaid(st.lm.id)}>Mark Unpaid</Btn>}
 </div>
 </div>;
 })()
 :<div>
 {allStubs.length===0?<Card><p style={{color:T.textDim,textAlign:"center",padding:32}}>No {tab} payable for this week.</p></Card>
 :allStubs.map(st=>{
 const hasBa=!!bankAccounts[st.lm.id];
 return <Card key={st.lm.id} hover onClick={()=>setSelLM(st.lm.id)} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <div style={{width:36,height:36,borderRadius:4,background:`${T.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:T.accent}}>
 {st.lm.name.split(" ").map(n=>n[0]).join("")}
 </div>
 <div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{st.lm.name}</div>
 <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
 <span style={{fontSize:11,color:T.textMuted}}>{st.jobs.length} job{st.jobs.length!==1?"s":""}</span>
 {hasBa?<span style={{fontSize:10,color:T.success,display:"flex",alignItems:"center",gap:3}}>
 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
 Direct Deposit
 </span>:<span style={{fontSize:10,color:T.danger}}>No Bank Account</span>}
 </div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:14}}>
 <span style={{fontSize:18,fontWeight:600,color:T.success}}>{$(st.totalPay)}</span>
 {st.paid?<Badge label="PAID" color={T.success} bg={T.successSoft}/>:<Badge label="PENDING" color={T.warning} bg={T.warningSoft}/>}
 </div>
 </div>
 </Card>;
 })}

 {/* Processed payroll receipt */}
 {run?.status==="completed"&&<Card style={{marginTop:20,padding:18,borderColor:T.success+"33"}}>
 <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:12}}>Payment Receipt — Week {wn}</div>
 <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:0,fontSize:12}}>
 <div style={{padding:"8px 0",color:T.textMuted,fontWeight:600,borderBottom:`1px solid ${T.border}`}}>Payee</div>
 <div style={{padding:"8px 0",color:T.textMuted,fontWeight:600,borderBottom:`1px solid ${T.border}`}}>Role</div>
 <div style={{padding:"8px 0",color:T.textMuted,fontWeight:600,textAlign:"right",borderBottom:`1px solid ${T.border}`}}>Amount</div>
 <div style={{padding:"8px 0",color:T.textMuted,fontWeight:600,textAlign:"right",borderBottom:`1px solid ${T.border}`}}>Status</div>
 {run.items.map((it,i)=><React.Fragment key={i}>
 <div style={{padding:"8px 0",color:T.text,borderBottom:`1px solid ${T.border}`}}>{it.name}</div>
 <div style={{padding:"8px 0",color:T.textMuted,borderBottom:`1px solid ${T.border}`}}>{it.role.replace("_"," ")}</div>
 <div style={{padding:"8px 0",color:T.success,fontWeight:600,textAlign:"right",borderBottom:`1px solid ${T.border}`}}>{$(it.amount)}</div>
 <div style={{padding:"8px 0",textAlign:"right",borderBottom:`1px solid ${T.border}`}}>
 <span style={{fontSize:10,color:T.success,display:"inline-flex",alignItems:"center",gap:3}}>
 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
 ····{it.bankLast4}
 </span>
 </div>
 </React.Fragment>)}
 </div>
 <div style={{display:"flex",justifyContent:"space-between",marginTop:12,paddingTop:10,borderTop:`2px solid ${T.success}33`}}>
 <span style={{fontSize:13,fontWeight:600,color:T.text}}>Total Distributed</span>
 <span style={{fontSize:16,fontWeight:700,color:T.success}}>{$(run.totalAmount)}</span>
 </div>
 </Card>}
 </div>}
 </div>;
}

// ─── PAY STUBS VIEW (Lineman) ────────────────────────────────────────────────
function PayStubsView(){
 const{jobs,rateCards,currentUser,paidStubs}=useApp();
 const[selWeek,setSelWeek]=useState(null);

 const myWeeks=useMemo(()=>{
 const wks={};
 jobs.filter(j=>j.assignedLineman===currentUser.id&&j.production?.completedDate).forEach(j=>{
 const k=payWeekKey(new Date(j.production.completedDate));
 if(!wks[k])wks[k]={key:k,jobs:[],totalPay:0,byType:{}};
 wks[k].jobs.push(j);
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){
 wks[k].totalPay+=f.totals.linemanPay;
 f.items.filter(i=>i.linemanAmount>0).forEach(item=>{
 if(!wks[k].byType[item.description])wks[k].byType[item.description]={desc:item.description,qty:0,rate:item.linemanRate,unit:item.unit,amount:0};
 wks[k].byType[item.description].qty+=item.qty;
 wks[k].byType[item.description].amount+=item.linemanAmount;
 });
 }
 });
 return Object.values(wks).sort((a,b)=>b.key.localeCompare(a.key));
 },[jobs,rateCards,currentUser]);

 const sel=selWeek?myWeeks.find(w=>w.key===selWeek):null;
 const isPaid=(k)=>!!(paidStubs[`${currentUser.id}|${k}`]);

 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>My Pay Stubs</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 16px"}}>Weekly production earnings — paid one month after work week</p>

 {sel?<div>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
 <Btn v="ghost" sz="sm" onClick={()=>setSelWeek(null)}>← Back</Btn>
 <h2 style={{fontSize:16,fontWeight:700,color:T.text,margin:0}}>Week {weekNumber(sel.key)}</h2>
 {isPaid(sel.key)?<Badge label="PAID" color={T.success} bg={T.successSoft}/>:<Badge label="PENDING" color={T.warning} bg={T.warningSoft}/>}
 </div>
 <Card style={{marginBottom:14,padding:20,background:`linear-gradient(135deg, ${T.bgCard}, ${T.bgCard})`,borderColor:T.success+"44"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
 <div>
 <div style={{fontSize:18,fontWeight:600,color:T.text}}>Week {weekNumber(sel.key)}</div>
 <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>{payWeekLabel(sel.key)}</div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:6}}>Pay Date: <b style={{color:T.text}}>{fd(payDate(sel.key))}</b></div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{sel.jobs.length} job{sel.jobs.length!==1?"s":""}</div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Week Total</div>
 <div style={{fontSize:36,fontWeight:600,color:T.success,lineHeight:1.1}}>{$(sel.totalPay)}</div>
 </div>
 </div>
 </Card>

 {/* Work type totals */}
 <Card style={{marginBottom:14,padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:0.4}}>Earnings by Work Type</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:10}}>
 {Object.values(sel.byType).map((t,i)=><div key={i} style={{padding:12,background:T.bgInput,borderRadius:4}}>
 <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4}}>{t.desc.replace(" (footage)","")}</div>
 <div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(t.amount)}</div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{t.qty.toLocaleString()} {t.unit==="per foot"?"ft":"ea"} × {$(t.rate)}</div>
 </div>)}
 </div>
 </Card>

 {/* Per-job breakdown */}
 {sel.jobs.map((j,i)=>{
 const f=calcJob(j,rateCards);const items=f.items?.filter(it=>it.linemanAmount>0)||[];const pay=f.totals?.linemanPay||0;
 return <Card key={i} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <div><span style={{fontWeight:700,color:T.accent,fontFamily:"monospace",fontSize:12}}>{j.feederId}</span> <span style={{color:T.textMuted,fontSize:12}}>· {fd(j.production?.completedDate)}</span></div>
 <span style={{fontWeight:700,fontSize:14,color:T.success}}>{$(pay)}</span>
 </div>
 {items.map((item,ii)=><div key={ii} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}>
 <span style={{color:T.text}}>{item.description.replace(" (footage)","")}</span>
 <div style={{display:"flex",gap:12}}><span style={{color:T.textMuted}}>{item.qty.toLocaleString()} × {$(item.linemanRate)}</span><span style={{fontWeight:600,color:T.success}}>{$(item.linemanAmount)}</span></div>
 </div>)}
 </Card>;
 })}
 </div>

 :<div>
 {myWeeks.length===0?<Card><p style={{color:T.textDim,textAlign:"center",padding:32}}>No pay stubs yet. Submit production to see your earnings here.</p></Card>
 :myWeeks.map(w=><Card key={w.key} hover onClick={()=>setSelWeek(w.key)} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{fontSize:14,fontWeight:700,color:T.accent}}>Week {weekNumber(w.key)}</span>
 {isPaid(w.key)?<Badge label="PAID" color={T.success} bg={T.successSoft}/>:<Badge label="PENDING" color={T.warning} bg={T.warningSoft}/>}
 </div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{payWeekLabel(w.key)}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:1}}>Pay Date: {fd(payDate(w.key))} · {w.jobs.length} job{w.jobs.length!==1?"s":""}</div>
 </div>
 <span style={{fontSize:20,fontWeight:600,color:T.success}}>{$(w.totalPay)}</span>
 </div>
 </Card>)}
 </div>}
 </div>;
}

function InvestorStubsView(){
 const{jobs,rateCards,currentUser,trucks}=useApp();
 const[selWeek,setSelWeek]=useState(null);
 const myTrucks=currentUser.trucks||[];

 const myWeeks=useMemo(()=>{
 const wks={};
 jobs.filter(j=>myTrucks.includes(j.assignedTruck)&&j.production?.completedDate).forEach(j=>{
 const k=payWeekKey(new Date(j.production.completedDate));
 if(!wks[k])wks[k]={key:k,jobs:[],totalReturns:0,byType:{},byTruck:{}};
 wks[k].jobs.push(j);
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){
 wks[k].totalReturns+=f.totals.investorCommission;
 // By work type
 f.items.filter(i=>i.investorAmount>0).forEach(item=>{
 if(!wks[k].byType[item.description])wks[k].byType[item.description]={desc:item.description,qty:0,rate:item.investorRate,unit:item.unit,amount:0};
 wks[k].byType[item.description].qty+=item.qty;
 wks[k].byType[item.description].amount+=item.investorAmount;
 });
 // By truck
 const tid=j.assignedTruck;
 if(!wks[k].byTruck[tid])wks[k].byTruck[tid]={truckId:tid,jobs:0,returns:0};
 wks[k].byTruck[tid].jobs++;
 wks[k].byTruck[tid].returns+=f.totals.investorCommission;
 }
 });
 return Object.values(wks).sort((a,b)=>b.key.localeCompare(a.key));
 },[jobs,rateCards,currentUser,myTrucks]);

 const sel=selWeek?myWeeks.find(w=>w.key===selWeek):null;

 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>My Returns</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 16px"}}>Weekly truck production returns — paid one month after work week</p>

 {sel?<div>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
 <Btn v="ghost" sz="sm" onClick={()=>setSelWeek(null)}>← Back</Btn>
 <h2 style={{fontSize:16,fontWeight:700,color:T.text,margin:0}}>Week {weekNumber(sel.key)}</h2>
 </div>
 <Card style={{marginBottom:14,padding:20,background:`linear-gradient(135deg, ${T.bgCard}, ${T.bgCard})`,borderColor:T.success+"44"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
 <div>
 <div style={{fontSize:18,fontWeight:600,color:T.text}}>Week {weekNumber(sel.key)}</div>
 <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>{payWeekLabel(sel.key)}</div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:6}}>Pay Date: <b style={{color:T.text}}>{fd(payDate(sel.key))}</b></div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{sel.jobs.length} job{sel.jobs.length!==1?"s":""} across {Object.keys(sel.byTruck).length} truck{Object.keys(sel.byTruck).length!==1?"s":""}</div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Week Total</div>
 <div style={{fontSize:36,fontWeight:600,color:T.success,lineHeight:1.1}}>{$(sel.totalReturns)}</div>
 </div>
 </div>
 </Card>

 {/* By truck breakdown */}
 <Card style={{marginBottom:14,padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:0.4}}>Returns by Truck</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:10}}>
 {Object.values(sel.byTruck).map(t=>{
 const truck=trucks.find(tr=>tr.id===t.truckId);
 return <div key={t.truckId} style={{padding:12,background:T.bgInput,borderRadius:4,borderTop:`2px solid ${T.orange}`}}>
 <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4}}>{t.truckId}</div>
 <div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(t.returns)}</div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{t.jobs} job{t.jobs!==1?"s":""}</div>
 </div>;
 })}
 </div>
 </Card>

 {/* By work type */}
 {Object.keys(sel.byType).length>0&&<Card style={{marginBottom:14,padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:0.4}}>Returns by Work Type</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:10}}>
 {Object.values(sel.byType).map((t,i)=><div key={i} style={{padding:12,background:T.bgInput,borderRadius:4}}>
 <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4}}>{t.desc.replace(" (footage)","")}</div>
 <div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(t.amount)}</div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{t.qty.toLocaleString()} {t.unit==="per foot"?"ft":"ea"} × {$(t.rate)}</div>
 </div>)}
 </div>
 </Card>}

 {/* Per-job breakdown */}
 {sel.jobs.map((j,i)=>{
 const f=calcJob(j,rateCards);const items=f.items?.filter(it=>it.investorAmount>0)||[];const ret=f.totals?.investorCommission||0;
 const lm=USERS.find(u=>u.id===j.assignedLineman);
 return <Card key={i} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <div>
 <span style={{fontWeight:700,color:T.accent,fontFamily:"monospace",fontSize:12}}>{j.feederId}</span>
 <span style={{color:T.textMuted,fontSize:12}}> · {fd(j.production?.completedDate)}</span>
 <div style={{fontSize:11,color:T.textDim,marginTop:2}}>{j.assignedTruck} · {lm?.name||"Unknown"}</div>
 </div>
 <span style={{fontWeight:700,fontSize:14,color:T.success}}>{$(ret)}</span>
 </div>
 {items.map((item,ii)=><div key={ii} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}>
 <span style={{color:T.text}}>{item.description.replace(" (footage)","")}</span>
 <div style={{display:"flex",gap:12}}><span style={{color:T.textMuted}}>{item.qty.toLocaleString()} × {$(item.investorRate)}</span><span style={{fontWeight:600,color:T.success}}>{$(item.investorAmount)}</span></div>
 </div>)}
 </Card>;
 })}
 </div>

 :<div>
 {myWeeks.length===0?<Card><p style={{color:T.textDim,textAlign:"center",padding:32}}>No returns yet. Production on your trucks will appear here.</p></Card>
 :myWeeks.map(w=><Card key={w.key} hover onClick={()=>setSelWeek(w.key)} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{fontSize:14,fontWeight:700,color:T.accent}}>Week {weekNumber(w.key)}</span>
 <span style={{fontSize:11,color:T.textDim}}>{Object.keys(w.byTruck).length} truck{Object.keys(w.byTruck).length!==1?"s":""}</span>
 </div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{payWeekLabel(w.key)}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:1}}>Pay Date: {fd(payDate(w.key))} · {w.jobs.length} job{w.jobs.length!==1?"s":""}</div>
 </div>
 <span style={{fontSize:20,fontWeight:600,color:T.success}}>{$(w.totalReturns)}</span>
 </div>
 </Card>)}
 </div>}
 </div>;
}

function UsersView(){
 const{trucks,drills}=useApp();
 const allRoles=["admin","supervisor","lineman","foreman","billing","redline_specialist","client_manager","truck_investor","drill_investor"];
 const rb=(role)=>{const cs={admin:T.danger,supervisor:T.accent,lineman:T.cyan,billing:T.success,redline_specialist:T.warning,client_manager:T.purple,truck_investor:T.orange,foreman:T.cyan,drill_investor:T.orange};
 return <span style={{padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,color:cs[role]||T.textMuted,background:(cs[role]||T.textMuted)+"18"}}>{role.replace(/_/g," ")}</span>;};
 const[editUser,setEditUser]=useState(null);
 const[editVals,setEditVals]=useState({});
 const[showAdd,setShowAdd]=useState(false);
 const[newUser,setNewUser]=useState({name:"",email:"",role:"lineman"});
 const[users,setUsers]=useState(USERS);

 const openEdit=(u)=>{setEditUser(u.id);setEditVals({name:u.name,email:u.email,role:u.role,trucks:u.trucks||[],drills:u.drills||[]});};
 const saveEdit=()=>{
  const idx=users.findIndex(u=>u.id===editUser);if(idx<0)return;
  const updated=[...users];updated[idx]={...updated[idx],...editVals};
  setUsers(updated);USERS.splice(0,USERS.length,...updated);setEditUser(null);
 };
 const addUser=()=>{
  if(!newUser.name.trim()||!newUser.email.trim())return;
  const u={id:"u"+Date.now(),name:newUser.name,email:newUser.email,role:newUser.role};
  if(u.role==="truck_investor")u.trucks=[];
  if(u.role==="drill_investor")u.drills=[];
  const updated=[...users,u];setUsers(updated);USERS.splice(0,USERS.length,...updated);
  setShowAdd(false);setNewUser({name:"",email:"",role:"lineman"});
 };
 const deleteUser=(id)=>{const updated=users.filter(u=>u.id!==id);setUsers(updated);USERS.splice(0,USERS.length,...updated);setEditUser(null);};

 const InputRow=({label,value,onChange,type,options})=><div style={{marginBottom:10}}>
  <label style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.3,display:"block",marginBottom:3}}>{label}</label>
  {options?<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>
  {options.map(o=><option key={o} value={o}>{o.replace(/_/g," ")}</option>)}
  </select>:<input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/>}
 </div>;

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
 <div><h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Users & Roles</h1><p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{users.length} users</p></div>
 <Btn onClick={()=>setShowAdd(true)}>+ Add User</Btn>
 </div>
 <DT columns={[
 {key:"name",label:"Name",render:r=><span style={{fontWeight:600}}>{r.name}</span>},
 {key:"email",label:"Email",render:r=><span style={{color:T.textMuted,fontSize:12}}>{r.email}</span>},
 {key:"role",label:"Role",render:r=>rb(r.role)},
 {key:"scope",label:"Scope / Assets",render:r=>{
  if(r.scope)return <span style={{fontSize:11,color:T.textMuted}}>{r.scope.customer||r.scope.client} / {r.scope.region||r.scope.regions?.join(", ")||"All"}</span>;
  if(r.trucks?.length)return <span style={{fontSize:11,color:T.textMuted}}>{r.trucks.join(", ")}</span>;
  if(r.drills?.length)return <span style={{fontSize:11,color:T.textMuted}}>{r.drills.join(", ")}</span>;
  return <span style={{color:T.textDim}}>—</span>;
 }},
 {key:"a",label:"",render:r=><Btn v="ghost" sz="sm" onClick={e=>{e.stopPropagation();openEdit(r);}}>Edit</Btn>},
 ]} data={users}/>

 {/* Edit user modal */}
 <Modal open={!!editUser} onClose={()=>setEditUser(null)} title="Edit User" width={440}>
 {editUser&&<div>
  <InputRow label="Name" value={editVals.name} onChange={v=>setEditVals(p=>({...p,name:v}))}/>
  <InputRow label="Email" value={editVals.email} onChange={v=>setEditVals(p=>({...p,email:v}))}/>
  <InputRow label="Role" value={editVals.role} onChange={v=>setEditVals(p=>({...p,role:v}))} options={allRoles}/>
  {editVals.role==="truck_investor"&&<div style={{marginBottom:10}}>
  <label style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.3,display:"block",marginBottom:6}}>Assigned Trucks</label>
  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
  {trucks.map(t=>{const has=(editVals.trucks||[]).includes(t.id);
  return <button key={t.id} onClick={()=>setEditVals(p=>({...p,trucks:has?p.trucks.filter(x=>x!==t.id):[...(p.trucks||[]),t.id]}))} style={{padding:"4px 10px",borderRadius:4,fontSize:11,fontWeight:600,border:`1px solid ${has?T.accent:T.border}`,background:has?T.accentSoft:"transparent",color:has?T.accent:T.textMuted,cursor:"pointer"}}>{t.id}</button>;
  })}
  </div>
  </div>}
  {editVals.role==="drill_investor"&&<div style={{marginBottom:10}}>
  <label style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.3,display:"block",marginBottom:6}}>Assigned Drills</label>
  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
  {drills.map(d=>{const has=(editVals.drills||[]).includes(d.id);
  return <button key={d.id} onClick={()=>setEditVals(p=>({...p,drills:has?p.drills.filter(x=>x!==d.id):[...(p.drills||[]),d.id]}))} style={{padding:"4px 10px",borderRadius:4,fontSize:11,fontWeight:600,border:`1px solid ${has?T.accent:T.border}`,background:has?T.accentSoft:"transparent",color:has?T.accent:T.textMuted,cursor:"pointer"}}>{d.id}</button>;
  })}
  </div>
  </div>}
  <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
  <button onClick={()=>{if(confirm(`Delete ${editVals.name}?`))deleteUser(editUser);}} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:12,fontWeight:600}}>Delete User</button>
  <div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={()=>setEditUser(null)}>Cancel</Btn><Btn onClick={saveEdit}>Save</Btn></div>
  </div>
 </div>}
 </Modal>

 {/* Add user modal */}
 <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Add User" width={440}>
 <div>
  <InputRow label="Name" value={newUser.name} onChange={v=>setNewUser(p=>({...p,name:v}))}/>
  <InputRow label="Email" value={newUser.email} onChange={v=>setNewUser(p=>({...p,email:v}))}/>
  <InputRow label="Role" value={newUser.role} onChange={v=>setNewUser(p=>({...p,role:v}))} options={allRoles}/>
  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}><Btn v="ghost" onClick={()=>setShowAdd(false)}>Cancel</Btn><Btn onClick={addUser} disabled={!newUser.name.trim()||!newUser.email.trim()}>Add User</Btn></div>
 </div>
 </Modal>
 </div>;
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function NavBtn({active,collapsed,onClick,title,icon,label,badge,sidebarTheme}){
 const[h,setH]=useState(false);
 const S=sidebarTheme||SIDEBAR_THEME;
 return <button onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onClick={onClick} title={title} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:collapsed?"9px 0":"9px 12px",justifyContent:collapsed?"center":"flex-start",borderRadius:5,border:"none",cursor:"pointer",position:"relative",
 background:active?S.accentSoft:h?"rgba(107,155,210,0.06)":"transparent",
 color:active?S.accent:h?"#E0E4EC":S.text,
 fontSize:13,fontWeight:active?500:400,marginBottom:2,textAlign:"left",transition:"all 0.15s ease",
 transform:h&&!active?"translateX(2px)":"none",
 boxShadow:h&&!active?`inset 3px 0 0 ${S.accent}66`:"none"}}>
 <span style={{display:'flex',alignItems:'center',justifyContent:'center',width:18,height:18,minWidth:18,opacity:active||h?1:0.55,transition:'all 0.15s',transform:h?"scale(1.1)":"scale(1)",position:"relative"}}>{icon}
 {badge>0&&collapsed&&<span style={{position:"absolute",top:-5,right:-5,width:14,height:14,borderRadius:"50%",background:"#C62828",color:"#fff",fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{badge}</span>}
 </span>
 {!collapsed&&<span style={{transition:"opacity 0.15s ease 0.04s",opacity:1,flex:1}}>{label}</span>}
 {!collapsed&&badge>0&&<span style={{width:18,height:18,borderRadius:"50%",background:"#C62828",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{badge}</span>}
 </button>;
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({view,setView,currentUser,onSwitch,sidebarOpen,setSidebarOpen,isMobile}){
 const ctx=useApp();
 const{jobs,rateCards,dark,setDark,trucks,drills,tickets}=useApp();
 const collapsed=isMobile?false:!sidebarOpen; // On mobile, sidebar is always "expanded" when shown
 const W=isMobile?280:(sidebarOpen?240:56);
 const sidebarTimerRef=React.useRef(null);
 const handleMouseEnter=()=>{if(isMobile)return;clearTimeout(sidebarTimerRef.current);setSidebarOpen(true);};
 const handleMouseLeave=()=>{if(isMobile)return;clearTimeout(sidebarTimerRef.current);sidebarTimerRef.current=setTimeout(()=>setSidebarOpen(false),120);};
 // Compute lineman earnings for sidebar — current week only
 const lmEarnings=useMemo(()=>{
 if(currentUser.role!=="lineman"&&currentUser.role!=="foreman")return null;
 const thisWeek=payWeekKey(new Date());
 let total=0,count=0;
 jobs.filter(j=>j.assignedLineman===currentUser.id&&j.production?.completedDate&&payWeekKey(new Date(j.production.completedDate))===thisWeek).forEach(j=>{
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){total+=f.totals.linemanPay;count++;}
 });
 return{total,count};
 },[currentUser,jobs,rateCards]);

 const NI=(name,s=16,c="currentColor")=>{const icons={
 dashboard:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
 jobs:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/></svg>,
 trucks:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h1"/><path d="M15 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.684-.948V8h4.5l1.5 4.5V17a1 1 0 0 1-1 1h-1"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/></svg>,
 drills:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
 ratecards:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
 payroll:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
 users:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
 paystubs:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
 returns:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>,
 production:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
 redline:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
 review:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
 field:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
 compliance:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9,12 11,14 15,10"/></svg>,
 materials:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
 dispatch:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>,
 messages:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
 map_cutter:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
 tickets:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>,
 splicing:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/></svg>,
 };return icons[name]||null;};
 const nav=(()=>{
 const cc=ctx?.companyConfig||{departments:["aerial","underground"],hasEquipmentOwners:true};
 const hasAerial=cc.departments.includes("aerial");
 const hasUG=cc.departments.includes("underground");
 const hasOwners=cc.hasEquipmentOwners;
 const ownerLabel=cc.equipmentOwnerLabel||"Investor";
 const adminNav=[
  {k:"dashboard",l:"Dashboard",i:"dashboard"},
  {k:"jobs",l:"Jobs",i:"jobs"},
  {k:"tickets",l:"Tickets",i:"tickets"},
  {k:"map_cutter",l:"Map Cutter",i:"map_cutter"},
  {k:"dispatch",l:"Dispatch",i:"dispatch"},
 ];
 if(hasAerial)adminNav.push({k:"trucks",l:"Trucks",i:"trucks"});
 if(hasUG)adminNav.push({k:"drills",l:"Drills",i:"drills"});
 adminNav.push({k:"materials",l:"Materials",i:"materials"});
 adminNav.push({k:"splicing",l:"Splicing",i:"splicing"});
 adminNav.push({k:"compliance",l:"Compliance",i:"compliance"});
 adminNav.push({k:"ratecards",l:"Rate Cards",i:"ratecards"});
 adminNav.push({k:"invoicing",l:"Invoicing",i:"paystubs"});
 adminNav.push({k:"reports",l:"Reports",i:"dashboard"});
 adminNav.push({k:"payroll",l:"Payroll",i:"payroll"});
 adminNav.push({k:"users",l:"Users",i:"users"});
 adminNav.push({k:"settings",l:"Settings",i:"compliance"});
 return {
 admin:adminNav,
 supervisor:[{k:"supervisor_dashboard",l:"Dashboard",i:"dashboard"},{k:"jobs",l:"Jobs",i:"jobs"},{k:"tickets",l:"Tickets",i:"tickets"},{k:"map_cutter",l:"Map Cutter",i:"map_cutter"},{k:"dispatch",l:"Dispatch",i:"dispatch"},{k:"supervisor_stubs",l:"Pay Stubs",i:"paystubs"}],
 billing:[{k:"dashboard",l:"Dashboard",i:"dashboard"},{k:"jobs",l:"Jobs",i:"jobs"},{k:"invoicing",l:"Invoicing",i:"paystubs"},{k:"tickets",l:"Tickets",i:"tickets"}],
 lineman:[{k:"jobs",l:"My Jobs",i:"jobs"},{k:"my_schedule",l:"My Schedule",i:"dispatch"},{k:"paystubs",l:"Pay Stubs",i:"paystubs"}],
 foreman:[{k:"jobs",l:"My Jobs",i:"jobs"},{k:"my_schedule",l:"My Schedule",i:"dispatch"},{k:"foreman_stubs",l:"Pay Stubs",i:"paystubs"}],
 redline_specialist:[{k:"jobs",l:"Redline Queue",i:"redline"}],
 client_manager:[{k:"client_portal",l:"Dashboard",i:"dashboard"},{k:"tickets",l:"Tickets",i:"tickets"},{k:"crew_visibility",l:"Crew Map",i:"dispatch"},{k:"redline_review",l:"Redlines",i:"map_cutter"},{k:"client_jobs",l:"Jobs",i:"jobs"},{k:"client_subs",l:"Subcontractors",i:"users"}],
 truck_investor:hasOwners?[{k:"investor_dashboard",l:"My Trucks",i:"trucks"},{k:"investor_stubs",l:"Returns",i:"returns"},{k:"truck_health",l:"Vehicle Health",i:"compliance"}]:[],
 drill_investor:hasOwners?[{k:"drill_investor_dashboard",l:"My Drills",i:"drills"},{k:"drill_investor_stubs",l:"Returns",i:"returns"},{k:"drill_health",l:"Equipment Health",i:"compliance"}]:[],
 };})();
 const items=nav[currentUser.role]||nav.admin;

 const compAlertCount=useMemo(()=>{
 let count=0;
 trucks.forEach(t=>{const c=t.compliance;if(!c)return;
 [c.dotInspection?.expires,c.insurance?.expires,c.registration?.expires,c.oilChange?.nextDue,c.tireInspection?.nextDue].forEach(d=>{const s=complianceStatus(d);if(s.status==="expired"||s.status==="critical"||s.status==="warning")count++;});});
 drills.forEach(d=>{const c=d.compliance;if(!c)return;
 [c.lastService?.nextDue,c.hydraulicInspection?.nextDue,c.bitReplacement?.nextDue].forEach(d=>{const s=complianceStatus(d);if(s.status==="expired"||s.status==="critical"||s.status==="warning")count++;});});
 Object.values(CDL_DATA).forEach(cdl=>{[cdl.expires,cdl.medicalCard?.expires].forEach(d=>{const s=complianceStatus(d);if(s.status==="expired"||s.status==="critical"||s.status==="warning")count++;});});
 return count;
 },[trucks,drills]);

 const openTickets=useMemo(()=>(tickets||[]).filter(t=>t.status==="Open"||t.status==="Acknowledged").length,[tickets]);

 const S=SIDEBAR_THEME;// Sidebar always dark

 return <>{isMobile&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:99,animation:"fadeIn 0.15s ease"}}/>}
 <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{width:W,minHeight:"100vh",background:S.bg,borderRight:`1px solid ${S.border}`,display:"flex",flexDirection:"column",position:"fixed",left:isMobile?(sidebarOpen?0:-300):0,top:0,bottom:0,zIndex:100,transition:isMobile?"left 0.28s cubic-bezier(0.25, 0.1, 0.25, 1)":"width 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.22s ease",overflow:isMobile?"auto":"hidden",whiteSpace:"nowrap",boxShadow:sidebarOpen?`8px 0 24px rgba(0,0,0,0.25)`:"none"}}>
 <div style={{padding:collapsed?"20px 12px":"20px 18px",borderBottom:`1px solid ${S.border}`,transition:"padding 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)"}}> <div style={{display:"flex",alignItems:"center",gap:10}}>
 <svg width={collapsed?36:38} height={collapsed?36:38} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
 <rect width="120" height="120" rx="26" fill="#FFFFFF"/>
 <rect x="2" y="2" width="116" height="116" rx="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2"/>
 <path d="M28 85 C38 85, 42 42, 55 42 C68 42, 65 78, 78 78 C91 78, 88 35, 95 35" stroke="#111111" strokeWidth="5.5" strokeLinecap="round" fill="none"/>
 <circle cx="55" cy="42" r="6" fill="#111111" opacity="0.9"/>
 <circle cx="78" cy="78" r="5" fill="#111111" opacity="0.75"/>
 <circle cx="95" cy="35" r="4.5" fill="#111111" opacity="0.85"/>
 <circle cx="28" cy="85" r="4.5" fill="#111111" opacity="0.7"/>
 <circle cx="55" cy="42" r="11" fill="none" stroke="#111111" strokeWidth="1.5" opacity="0.15"/>
 <circle cx="78" cy="78" r="9" fill="none" stroke="#111111" strokeWidth="1.5" opacity="0.1"/>
 <rect x="22" y="62" width="5" height="14" rx="2" fill="#111111" opacity="0.2"/>
 <rect x="30" y="56" width="5" height="20" rx="2" fill="#111111" opacity="0.25"/>
 <rect x="38" y="66" width="5" height="10" rx="2" fill="#111111" opacity="0.15"/>
 </svg>
 {!collapsed&&<div style={{opacity:sidebarOpen?1:0,transition:"opacity 0.18s ease 0.04s"}}><div style={{fontSize:14,letterSpacing:2,textTransform:"uppercase"}}><span style={{fontWeight:700,color:"#FFFFFF"}}>FIBER</span><span style={{fontWeight:400,color:"#666666"}}>LYTIC</span></div><div style={{fontSize:9,color:S.textDim,fontWeight:500,letterSpacing:0.6,textTransform:"uppercase",marginTop:2}}>Fiber Construction Operations</div></div>}
 </div>
 </div>
 <div style={{padding:collapsed?"16px 6px":"16px 10px",flex:1,transition:"padding 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)"}}>
 {!collapsed&&<div style={{fontSize:10,color:S.textDim,fontWeight:600,padding:"0 8px",marginBottom:8,letterSpacing:0.8,textTransform:"uppercase",opacity:sidebarOpen?1:0,transition:"opacity 0.18s ease 0.04s"}}>Navigation</div>}
 {items.map(it=>{const a=view===it.k||(it.k==="jobs"&&view==="job_detail");
 const badge=0;
 return <NavBtn key={it.k} active={a} collapsed={collapsed} onClick={()=>setView(it.k)} title={collapsed?it.l:""} icon={NI(it.i,18,a?S.accent:S.text)} label={it.l} badge={badge} sidebarTheme={S}/>;
 })}
 {/* Lineman weekly earnings in sidebar */}
 {!collapsed&&(currentUser.role==="lineman"||currentUser.role==="foreman")&&lmEarnings&&<div style={{margin:"16px 8px 0",padding:12,background:S.input,borderRadius:6,border:`1px solid ${S.border}`}}>
 <div style={{fontSize:10,color:S.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>This Week</div>
 <div style={{fontSize:18,fontWeight:600,color:"#34D399",lineHeight:1}}>{$(lmEarnings.total)}</div>
 <div style={{width:"100%",height:4,borderRadius:2,background:S.border,marginTop:8,overflow:"hidden"}}>
 <div style={{height:"100%",borderRadius:2,background:S.accent,width:`${Math.min((lmEarnings.total/5000)*100,100)}%`,transition:"width 0.5s"}}/>
 </div>
 <div style={{fontSize:9,color:S.textDim,marginTop:4}}>{lmEarnings.count} job{lmEarnings.count!==1?"s":""} this week</div>
 </div>}
 </div>
 <div style={{padding:collapsed?"12px 6px":"12px 14px",borderTop:`1px solid ${S.border}`,transition:"padding 0.2s"}}>
 {/* Dark mode toggle */}
 <button onClick={()=>setDark(!dark)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between",padding:collapsed?"8px 0":"8px 10px",borderRadius:5,border:`1px solid ${S.border}`,background:S.input,cursor:"pointer",marginBottom:12,transition:"all 0.15s"}}>
 {!collapsed&&<span style={{fontSize:12,fontWeight:400,color:S.text}}>{dark?"Dark mode":"Light mode"}</span>}
 <div style={{width:36,height:20,borderRadius:4,background:dark?S.accent:"#404B5E",position:"relative",transition:"background 0.2s",flexShrink:0}}>
 <div style={{width:16,height:16,borderRadius:4,background:"#fff",position:"absolute",top:2,left:dark?18:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
 </div>
 </button>
 {!collapsed&&<>
 <div style={{fontSize:10,color:S.textDim,fontWeight:600,marginBottom:8,letterSpacing:0.8,textTransform:"uppercase"}}>Switch Role (Demo)</div>
 <select value={currentUser.id} onChange={e=>onSwitch(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:4,fontSize:12,background:S.input,color:S.text,border:`1px solid ${S.border}`,cursor:"pointer"}}>
 {USERS.map(u=><option key={u.id} value={u.id}>{u.name} ({u.role.replace("_"," ")})</option>)}
 </select>
 <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12,padding:"8px 0"}}>
 <div style={{width:28,height:28,borderRadius:5,background:S.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:S.accent}}>
 {currentUser.name.split(" ").map(n=>n[0]).join("")}
 </div>
 <div><div style={{fontSize:12,fontWeight:600,color:S.text}}>{currentUser.name}</div><div style={{fontSize:10,color:S.textDim}}>{currentUser.role.replace("_"," ")}</div></div>
 </div>
 </>}
 {collapsed&&<div style={{display:"flex",justifyContent:"center",marginTop:4}}>
 <div style={{width:28,height:28,borderRadius:5,background:S.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:S.accent}}>
 {currentUser.name.split(" ").map(n=>n[0]).join("")}
 </div>
 </div>}
 </div>
 </div></>;
}

// ─── DRILLS MANAGEMENT ──────────────────────────────────────────────────────
function DrillsView(){
 const{jobs,setJobs,rateCards,drills,setDrills,companyConfig}=useApp();
 const[editDrill,setEditDrill]=useState(null);const[editFM,setEditFM]=useState("");
 const[editOwner,setEditOwner]=useState("");const[editInvName,setEditInvName]=useState("");
 const[showAdd,setShowAdd]=useState(false);
 const[newDrill,setNewDrill]=useState({id:"",equipment:"",ownerType:"",investorName:"",foremanId:""});
 const fms=USERS.filter(u=>u.role==="foreman");
 const investors=USERS.filter(u=>u.role==="drill_investor");
 const drillAssignments=useMemo(()=>{
 const map={};drills.forEach(d=>{
 const dJobs=jobs.filter(j=>j.assignedDrill===d.id);
 const activeJob=dJobs.find(j=>["Assigned","Pending Redlines","Under Client Review"].includes(j.status));
 const lmId=activeJob?.assignedLineman||dJobs[0]?.assignedLineman||null;
 const fm=lmId?USERS.find(u=>u.id===lmId):null;
 let returns=0;dJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals)returns+=f.totals.investorCommission;});
 map[d.id]={fm,fmId:lmId,jobCount:dJobs.length,activeCount:dJobs.filter(j=>["Assigned","Pending Redlines","Under Client Review"].includes(j.status)).length,returns};
 });return map;
 },[jobs,rateCards,drills]);
 const startEdit=(d)=>{setEditDrill(d.id);setEditFM(drillAssignments[d.id]?.fmId||"");setEditOwner(d.investorId?"Investor":"Company");setEditInvName(d.investorName||"");};
 const saveEdit=(drillId)=>{
 const inv=editOwner==="Investor"?investors.find(u=>u.name===editInvName):null;
 setDrills(drills.map(d=>d.id===drillId?{...d,owner:inv?inv.name:"Company",investorId:inv?.id||null,investorName:inv?.name||null}:d));
 setJobs(jobs.map(j=>{if(j.assignedDrill===drillId&&["Assigned","Unassigned"].includes(j.status))return{...j,assignedLineman:editFM||null,drillInvestor:inv?inv.name:null,status:editFM?"Assigned":"Unassigned"};return j;}));
 setEditDrill(null);
 };
 const addDrill=()=>{const did=(newDrill.id||"").trim();if(!did)return;const ownerType=newDrill.ownerType||"Company";const inv=ownerType==="Investor"?investors.find(u=>u.name===newDrill.investorName):null;
 setDrills(prev=>[...prev,{id:did,label:`${did} · ${newDrill.equipment||"TBD"}`,owner:inv?inv.name:"Company",investorId:inv?.id||null,investorName:inv?.name||null,
 compliance:{lastService:{date:"",nextDue:"",hours:0},hydraulicInspection:{date:"",nextDue:""},bitReplacement:{date:"",nextDue:"",bitsUsed:0}}}]);
 setNewDrill({id:"",equipment:"",ownerType:"",investorName:"",foremanId:""});setShowAdd(false);};
 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
 <div><h1 style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:4}}>Drills</h1><p style={{color:T.textMuted,fontSize:14}}>Manage drill assignments and ownership.</p></div>
 <Btn onClick={()=>setShowAdd(!showAdd)}>{showAdd?"Cancel":"+ Add Drill"}</Btn>
 </div>
 {showAdd&&<Card style={{marginBottom:16,borderColor:T.accent+"44"}}>
 <div style={{fontSize:13,fontWeight:700,color:T.accent,marginBottom:12}}>Add New Drill</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
 <Inp label="Drill ID" value={newDrill.id} onChange={v=>setNewDrill(p=>({...p,id:v}))} ph="DRL-203"/>
 <Inp label="Equipment" value={newDrill.equipment} onChange={v=>setNewDrill(p=>({...p,equipment:v}))} ph="2026 Vermeer D20x22"/>
 <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:0.4}}>Owner Type</label>
 <div style={{display:"flex",gap:6}}>{["Company","Investor"].map(o=><button key={o} onClick={()=>setNewDrill(p=>({...p,ownerType:o}))} style={{flex:1,padding:"8px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",border:`2px solid ${(newDrill.ownerType||"Company")===o?T.accent:T.border}`,background:(newDrill.ownerType||"Company")===o?T.accentSoft:"transparent",color:(newDrill.ownerType||"Company")===o?T.accent:T.textMuted}}>{o}</button>)}</div>
 </div>
 {(newDrill.ownerType||"Company")==="Investor"&&<Inp label="Investor" value={newDrill.investorName} onChange={v=>setNewDrill(p=>({...p,investorName:v}))} options={investors.map(u=>u.name)}/>}
 <Inp label="Assign Foreman" value={newDrill.foremanId} onChange={v=>setNewDrill(p=>({...p,foremanId:v}))} options={[{value:"",label:"— None —"},...fms.map(f=>({value:f.id,label:f.name}))]}/>
 </div>
 <Btn v="success" onClick={addDrill}>Add Drill</Btn>
 </Card>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:14,marginBottom:24}}>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Total Drills</div><div style={{fontSize:28,fontWeight:600,color:T.text,marginTop:4}}>{drills.length}</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Investor-Owned</div><div style={{fontSize:28,fontWeight:600,color:T.orange,marginTop:4}}>{drills.filter(d=>d.investorId).length}</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Company-Owned</div><div style={{fontSize:28,fontWeight:600,color:T.accent,marginTop:4}}>{drills.filter(d=>!d.investorId).length}</div></Card>
 </div>
 <Card style={{padding:0,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
 <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgInput}}>{["Drill","Equipment","Owner","Assigned Foreman","Jobs","Active","Returns",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.4}}>{h}</th>)}</tr></thead>
 <tbody>{drills.map(d=>{const a=drillAssignments[d.id]||{};const isInvestor=!!d.investorId;const isEditing=editDrill===d.id;
 return <React.Fragment key={d.id}><tr style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}} onClick={()=>{if(!isEditing)startEdit(d);}}>
 <td style={{padding:"12px 14px",fontWeight:700,color:T.text,whiteSpace:"nowrap"}}>{d.id}</td>
 <td style={{padding:"12px 14px",color:T.textMuted,fontSize:12}}>{d.label.split("·")[1]?.trim()}</td>
 <td style={{padding:"12px 14px",minWidth:160}}>{isEditing?<div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
 <select value={editOwner} onChange={e=>{setEditOwner(e.target.value);if(e.target.value==="Company")setEditInvName("");}} style={{padding:"4px 8px",fontSize:12,background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4}}><option value="Company">Company</option><option value="Investor">Investor</option></select>
 {editOwner==="Investor"&&<select value={editInvName} onChange={e=>setEditInvName(e.target.value)} style={{padding:"4px 8px",fontSize:12,background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4}}><option value="">Select...</option>{investors.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select>}
 </div>:isInvestor?<Badge label={d.investorName} color={T.orange} bg={T.orangeSoft}/>:<Badge label="Company" color={T.accent} bg={T.accentSoft}/>}</td>
 <td style={{padding:"12px 14px",minWidth:180}}>{isEditing?<Inp value={editFM} onChange={setEditFM} options={[{value:"",label:"— Unassigned —"},...fms.map(f=>({value:f.id,label:f.name}))]} style={{marginBottom:0,flex:1,fontSize:12}}/>:<span style={{fontWeight:600,color:a.fm?T.text:T.textDim}}>{a.fm?.name||"Unassigned"}</span>}</td>
 <td style={{padding:"12px 14px",textAlign:"center",fontWeight:700}}>{a.jobCount||0}</td>
 <td style={{padding:"12px 14px",textAlign:"center",fontWeight:700,color:T.accent}}>{a.activeCount||0}</td>
 <td style={{padding:"12px 14px",textAlign:"center",fontWeight:700,color:isInvestor?T.success:T.textDim}}>{isInvestor?$(a.returns||0):"—"}</td>
 <td style={{padding:"12px 14px",whiteSpace:"nowrap"}}>{isEditing?<div style={{display:"flex",gap:4}}><Btn sz="sm" v="success" onClick={()=>saveEdit(d.id)}>Save</Btn><Btn sz="sm" v="ghost" onClick={()=>setEditDrill(null)}>Cancel</Btn></div>:<button onClick={()=>startEdit(d)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:4,color:T.textMuted,cursor:"pointer",padding:"2px 8px",fontSize:11}}>Edit</button>}</td>
 </tr>
 {editDrill===d.id&&<tr><td colSpan={8} style={{padding:0,background:T.bgInput}}>
 <div style={{padding:"16px 20px"}}>
 <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12}}>Equipment Maintenance — {d.id}</div>
 <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min((companyConfig?.drillMaintenance||["Service","Hydraulic Inspection","Bit Replacement"]).length,4)},1fr)`,gap:10}}>
 {(companyConfig?.drillMaintenance||["Service","Hydraulic Inspection","Bit Replacement"]).map(cat=>{
  const path=cat.toLowerCase().replace(/\s+/g,"_");
  const data=d.compliance?.[path]||{};
  const expDate=data.nextDue||data.expires;
  const st=complianceStatus(expDate);
  return <Card key={cat} style={{padding:12,borderTop:`3px solid ${st.color}`}}>
   <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:2}}>{cat}</div>
   <div style={{fontSize:10,color:st.color,fontWeight:600,marginBottom:8}}>{st.label}</div>
   {[{k:"date",l:"Last Completed",type:"date"},{k:"nextDue",l:"Next Due",type:"date"},{k:"notes",l:"Notes",type:"text"}].map(f=><div key={f.k} style={{marginBottom:6}}>
    <label style={{fontSize:9,color:T.textMuted,fontWeight:600,textTransform:"uppercase",display:"block",marginBottom:2}}>{f.l}</label>
    <input type={f.type} value={data[f.k]||""} onChange={e=>{
     const nc={...d.compliance};nc[path]={...nc[path],[f.k]:e.target.value};
     setDrills(drills.map(x=>x.id===d.id?{...x,compliance:nc}:x));
    }} style={{width:"100%",padding:"5px 6px",borderRadius:3,border:`1px solid ${T.border}`,background:T.bg,color:T.text,fontSize:11,boxSizing:"border-box"}}/>
   </div>)}
  </Card>;
 })}
 </div>
 </div>
 </td></tr>}
 </React.Fragment>;})}</tbody>
 </table></Card>
 </div>;
}

// ─── TRUCKS MANAGEMENT ──────────────────────────────────────────────────────
function TrucksView(){
 const{jobs,setJobs,rateCards,trucks,setTrucks,companyConfig}=useApp();
 const[editTruck,setEditTruck]=useState(null);const[editLM,setEditLM]=useState("");
 const[editOwner,setEditOwner]=useState("");const[editInvName,setEditInvName]=useState("");
 const[showAdd,setShowAdd]=useState(false);
 const[newTruck,setNewTruck]=useState({id:"",vehicle:"",ownerType:"",investorName:"",linemanId:""});
 const lms=USERS.filter(u=>u.role==="lineman");
 const investors=USERS.filter(u=>u.role==="truck_investor");
 const truckAssignments=useMemo(()=>{
 const map={};trucks.forEach(t=>{
 const truckJobs=jobs.filter(j=>j.assignedTruck===t.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 const activeJob=truckJobs.find(j=>["Assigned","Pending Redlines","Under Client Review"].includes(j.status));
 const lmId=activeJob?.assignedLineman||truckJobs[0]?.assignedLineman||null;
 const lm=lmId?USERS.find(u=>u.id===lmId):null;
 let returns=0;truckJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals)returns+=f.totals.investorCommission;});
 map[t.id]={lm,lmId,jobCount:truckJobs.length,activeCount:truckJobs.filter(j=>["Assigned","Pending Redlines","Under Client Review"].includes(j.status)).length,returns};
 });return map;
 },[jobs,rateCards,trucks]);
 const startEdit=(t)=>{setEditTruck(t.id);setEditLM(truckAssignments[t.id]?.lmId||"");setEditOwner(t.investorId?"Investor":"Company");setEditInvName(t.investorName||"");};
 const saveEdit=(truckId)=>{
 const inv=editOwner==="Investor"?investors.find(u=>u.name===editInvName):null;
 setTrucks(trucks.map(t=>t.id===truckId?{...t,owner:inv?inv.name:"Company",investorId:inv?.id||null,investorName:inv?.name||null}:t));
 setJobs(jobs.map(j=>{if(j.assignedTruck===truckId&&["Assigned","Unassigned"].includes(j.status))return{...j,assignedLineman:editLM||null,truckInvestor:inv?inv.name:null,status:editLM?"Assigned":"Unassigned"};return j;}));
 setEditTruck(null);
 };
 const addTruck=()=>{const tid=(newTruck.id||"").trim();if(!tid)return;const ownerType=newTruck.ownerType||"Company";const inv=ownerType==="Investor"?investors.find(u=>u.name===newTruck.investorName):null;
 setTrucks(prev=>[...prev,{id:tid,label:`${tid} · ${newTruck.vehicle||"TBD"}`,vin:"",owner:inv?inv.name:"Company",investorId:inv?.id||null,investorName:inv?.name||null,
 compliance:{dotInspection:{date:"",expires:""},insurance:{provider:"",policy:"",expires:""},registration:{state:"",expires:""},oilChange:{last:"",nextDue:"",mileage:0},tireInspection:{date:"",nextDue:""}}}]);
 setNewTruck({id:"",vehicle:"",ownerType:"",investorName:"",linemanId:""});setShowAdd(false);};
 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
 <div><h1 style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:4}}>Trucks</h1><p style={{color:T.textMuted,fontSize:14}}>Manage truck assignments and ownership.</p></div>
 <Btn onClick={()=>setShowAdd(!showAdd)}>{showAdd?"Cancel":"+ Add Truck"}</Btn>
 </div>
 {showAdd&&<Card style={{marginBottom:16,borderColor:T.accent+"44"}}>
 <div style={{fontSize:13,fontWeight:700,color:T.accent,marginBottom:12}}>Add New Truck</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
 <Inp label="Truck ID" value={newTruck.id} onChange={v=>setNewTruck(p=>({...p,id:v}))} ph="TRK-109"/>
 <Inp label="Vehicle" value={newTruck.vehicle} onChange={v=>setNewTruck(p=>({...p,vehicle:v}))} ph="2025 Ford F-550"/>
 <Inp label="VIN" value={newTruck.vin||""} onChange={v=>setNewTruck(p=>({...p,vin:v}))} ph="1FDAF56R09EA32271"/>
 <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:0.4}}>Owner Type</label>
 <div style={{display:"flex",gap:6}}>{["Company","Investor"].map(o=><button key={o} onClick={()=>setNewTruck(p=>({...p,ownerType:o}))} style={{flex:1,padding:"8px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",border:`2px solid ${(newTruck.ownerType||"Company")===o?T.accent:T.border}`,background:(newTruck.ownerType||"Company")===o?T.accentSoft:"transparent",color:(newTruck.ownerType||"Company")===o?T.accent:T.textMuted}}>{o}</button>)}</div>
 </div>
 {(newTruck.ownerType||"Company")==="Investor"&&<Inp label="Investor" value={newTruck.investorName} onChange={v=>setNewTruck(p=>({...p,investorName:v}))} options={investors.map(u=>u.name)}/>}
 <Inp label="Assign Lineman" value={newTruck.linemanId} onChange={v=>setNewTruck(p=>({...p,linemanId:v}))} options={[{value:"",label:"— None —"},...lms.map(l=>({value:l.id,label:l.name}))]}/>
 </div>
 <Btn v="success" onClick={addTruck}>Add Truck</Btn>
 </Card>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:14,marginBottom:24}}>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Total Trucks</div><div style={{fontSize:28,fontWeight:600,color:T.text,marginTop:4}}>{trucks.length}</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Investor-Owned</div><div style={{fontSize:28,fontWeight:600,color:T.orange,marginTop:4}}>{trucks.filter(t=>t.investorId).length}</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Company-Owned</div><div style={{fontSize:28,fontWeight:600,color:T.accent,marginTop:4}}>{trucks.filter(t=>!t.investorId).length}</div></Card>
 </div>
 <Card style={{padding:0,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
 <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgInput}}>{["Truck","Vehicle","Owner","Assigned Lineman","Jobs","Active","Returns",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.4}}>{h}</th>)}</tr></thead>
 <tbody>{trucks.map(t=>{const a=truckAssignments[t.id]||{};const isInvestor=!!t.investorId;const isEditing=editTruck===t.id;
 return <React.Fragment key={t.id}><tr style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}} onClick={()=>{if(!isEditing)startEdit(t);}}>
 <td style={{padding:"12px 14px",fontWeight:700,color:T.text,whiteSpace:"nowrap"}}>{t.id}</td>
 <td style={{padding:"12px 14px",color:T.textMuted,fontSize:12}}>{t.label.split("·")[1]?.trim()}</td>
 <td style={{padding:"12px 14px",minWidth:160}}>{isEditing?<div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
 <select value={editOwner} onChange={e=>{setEditOwner(e.target.value);if(e.target.value==="Company")setEditInvName("");}} style={{padding:"4px 8px",fontSize:12,background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4}}><option value="Company">Company</option><option value="Investor">Investor</option></select>
 {editOwner==="Investor"&&<select value={editInvName} onChange={e=>setEditInvName(e.target.value)} style={{padding:"4px 8px",fontSize:12,background:T.bgInput,color:T.text,border:`1px solid ${T.border}`,borderRadius:4}}><option value="">Select...</option>{investors.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select>}
 </div>:isInvestor?<Badge label={t.investorName} color={T.orange} bg={T.orangeSoft}/>:<Badge label="Company" color={T.accent} bg={T.accentSoft}/>}</td>
 <td style={{padding:"12px 14px",minWidth:180}}>{isEditing?<div style={{display:"flex",gap:6,alignItems:"center"}}><Inp value={editLM} onChange={setEditLM} options={[{value:"",label:"— Unassigned —"},...lms.map(l=>({value:l.id,label:l.name}))]} style={{marginBottom:0,flex:1,fontSize:12}}/></div>:<span style={{fontWeight:600,color:a.lm?T.text:T.textDim}}>{a.lm?.name||"Unassigned"}</span>}</td>
 <td style={{padding:"12px 14px",textAlign:"center",fontWeight:700}}>{a.jobCount||0}</td>
 <td style={{padding:"12px 14px",textAlign:"center",fontWeight:700,color:T.accent}}>{a.activeCount||0}</td>
 <td style={{padding:"12px 14px",textAlign:"center",fontWeight:700,color:isInvestor?T.success:T.textDim}}>{isInvestor?$(a.returns||0):"—"}</td>
 <td style={{padding:"12px 14px",whiteSpace:"nowrap"}}>{isEditing?<div style={{display:"flex",gap:4}}><Btn sz="sm" v="success" onClick={()=>saveEdit(t.id)}>Save</Btn><Btn sz="sm" v="ghost" onClick={()=>setEditTruck(null)}>Cancel</Btn></div>:<button onClick={()=>startEdit(t)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:4,color:T.textMuted,cursor:"pointer",padding:"2px 8px",fontSize:11}}>Edit</button>}</td>
 </tr>
 {/* Expandable compliance detail */}
 {editTruck===t.id&&<tr><td colSpan={8} style={{padding:0,background:T.bgInput}}>
 <div style={{padding:"16px 20px"}}>
 <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12}}>Compliance & Maintenance — {t.id}</div>
 <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min((companyConfig?.truckMaintenance||[]).length||5,5)},1fr)`,gap:10}}>
 {(companyConfig?.truckMaintenance||["DOT Inspection","Insurance","Registration","Oil Change","Tire Inspection"]).map(cat=>{
  const path=cat.toLowerCase().replace(/\s+/g,"_");
  const data=t.compliance?.[path]||{};
  const expDate=data.nextDue||data.expires;
  const st=complianceStatus(expDate);
  return <Card key={cat} style={{padding:12,borderTop:`3px solid ${st.color}`}}>
   <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:2}}>{cat}</div>
   <div style={{fontSize:10,color:st.color,fontWeight:600,marginBottom:8}}>{st.label}</div>
   {[{k:"date",l:"Last Completed",type:"date"},{k:"nextDue",l:"Next Due",type:"date"},{k:"notes",l:"Notes / Details",type:"text"}].map(f=><div key={f.k} style={{marginBottom:6}}>
    <label style={{fontSize:9,color:T.textMuted,fontWeight:600,textTransform:"uppercase",display:"block",marginBottom:2}}>{f.l}</label>
    <input type={f.type} value={data[f.k]||""} onChange={e=>{
     const nc={...t.compliance};nc[path]={...nc[path],[f.k]:e.target.value};
     setTrucks(trucks.map(x=>x.id===t.id?{...x,compliance:nc}:x));
    }} style={{width:"100%",padding:"5px 6px",borderRadius:3,border:`1px solid ${T.border}`,background:T.bg,color:T.text,fontSize:11,boxSizing:"border-box"}}/>
   </div>)}
  </Card>;
 })}
 </div>
 </div>
 </td></tr>}
 </React.Fragment>;})}</tbody>
 </table></Card>
 </div>;
}

// ─── CLIENT PORTAL (Client Manager Dashboard) ────────────────────────────────
function ClientPortal(){
 const{jobs,rateCards,currentUser,tickets,setTickets,setView,setSelectedJob,setNavFrom,setJobsPreFilter,clientSubFilter}=useApp();
 const navigateTo=(target,preFilter)=>{setNavFrom({view:"client_portal",label:"Client Portal"});if(preFilter)setJobsPreFilter(preFilter);setView(target);};
 const scope=currentUser.scope||{};
 const scopeFilter=(j)=>j.client===scope.client&&(!scope.customer||j.customer===scope.customer)&&(!scope.regions||scope.regions.includes(j.region))&&(clientSubFilter==="all"||j.subcontractor===clientSubFilter);
 const[period,setPeriod]=useState("month");
 const now=new Date();
 const TSC={Open:{c:T.warning,bg:T.warningSoft},Acknowledged:{c:T.accent,bg:T.accentSoft},Resolved:{c:T.success,bg:T.successSoft},Rejected:{c:T.danger,bg:T.dangerSoft}};
 const TPC={urgent:{c:T.danger,l:'URGENT'},high:{c:T.warning,l:'HIGH'},normal:{c:T.textMuted,l:'NORMAL'}};
 const todayStr=now.toISOString().split('T')[0];
 const todayTickets=tickets.filter(t=>t.createdAt.split('T')[0]===todayStr||t.messages.some(m=>m.ts.split('T')[0]===todayStr));

 const periodStart=period==="week"?(() => {const d=new Date(now);d.setDate(d.getDate()-(d.getDay()||7)+1);d.setHours(0,0,0,0);return d;})()
 :period==="month"?new Date(now.getFullYear(),now.getMonth(),1)
 :period==="year"?new Date(now.getFullYear(),0,1):new Date(0);

 const d=useMemo(()=>{
 const clientJobs=jobs.filter(scopeFilter);
 const tfj=clientJobs.filter(j=>j.production?.completedDate&&new Date(j.production.completedDate)>=periodStart);
 let tRev=0,tFeet=0,calcCount=0;
 const byCustRegion={},bySub={};
 tfj.forEach(j=>{
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){
 tRev+=f.totals.nextgenRevenue;tFeet+=j.production?.totalFeet||0;calcCount++;
 const crKey=`${j.customer}|${j.region}`;
 if(!byCustRegion[crKey])byCustRegion[crKey]={customer:j.customer,region:j.region,rev:0,feet:0,jobs:0};
 byCustRegion[crKey].rev+=f.totals.nextgenRevenue;byCustRegion[crKey].feet+=j.production?.totalFeet||0;byCustRegion[crKey].jobs++;
 }
 const sub="NextGen Fiber";
 if(!bySub[sub])bySub[sub]={name:sub,rev:0,feet:0,jobs:0,completed:0,pending:0,total:0};
 bySub[sub].total++;if(j.production)bySub[sub].completed++;else bySub[sub].pending++;
 });
 Object.values(bySub).forEach(s=>{tfj.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals){s.rev+=f.totals.nextgenRevenue;s.feet+=j.production?.totalFeet||0;s.jobs++;}});});
 const avgCostPerFt=tFeet>0?(tRev/tFeet):0;
 const readyToInvoice=clientJobs.filter(j=>j.status==="Ready to Invoice").length;
 const billed=clientJobs.filter(j=>j.status==="Billed").length;
 const pendingReview=clientJobs.filter(j=>j.status==="Under Client Review"||j.status==="Pending Redlines").length;
 // All-time totals for project progress
 const allTimeFeet=clientJobs.filter(j=>j.production).reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 // Weekly breakdown for trend (last 8 weeks)
 const weeklyTrend=Array.from({length:8},(_,wi)=>{
 const ws=new Date(now);ws.setDate(ws.getDate()-ws.getDay()-((7-wi)*7)+1);ws.setHours(0,0,0,0);
 const we=new Date(ws);we.setDate(we.getDate()+7);
 const wFeet=clientJobs.filter(j=>j.production?.completedDate&&new Date(j.production.completedDate)>=ws&&new Date(j.production.completedDate)<we).reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 return{week:`W${wi+1}`,feet:wFeet,label:`${ws.getMonth()+1}/${ws.getDate()}`};
 });
 return{clientJobs,tfj,tRev,tFeet,calcCount,byCustRegion,bySub,avgCostPerFt,readyToInvoice,billed,pendingReview,allTimeFeet,weeklyTrend};
 },[jobs,rateCards,scope,periodStart]);

 // Production feed — recent submissions sorted by time
 const feed=useMemo(()=>{
 return jobs.filter(j=>scopeFilter(j)&&j.production?.submittedAt)
 .sort((a,b)=>b.production.submittedAt.localeCompare(a.production.submittedAt))
 .slice(0,25);
 },[jobs,scope]);

 // Project target (simulated)
 const projectTarget=1200000;
 const projectPct=Math.min((d.allTimeFeet/projectTarget)*100,100);
 const weeksRemaining=Math.max(0,Math.ceil((new Date("2026-12-31")-now)/(7*86400000)));
 const paceNeeded=weeksRemaining>0?Math.round((projectTarget-d.allTimeFeet)/weeksRemaining):0;
 const recentWeekAvg=d.weeklyTrend.slice(-4).reduce((s,w)=>s+w.feet,0)/4;
 const onPace=recentWeekAvg>=paceNeeded;

 const periodLabels={week:"This Week",month:"This Month",year:"This Year",all:"All Time"};
 const maxWeekFt=Math.max(...d.weeklyTrend.map(w=>w.feet),1);

 // Jobs needing review — the CM's core action
 const reviewQueue=jobs.filter(j=>scopeFilter(j)&&j.status==="Under Client Review").sort((a,b)=>(b.production?.submittedAt||"").localeCompare(a.production?.submittedAt||""));
 const activeTickets=tickets.filter(t=>t.status==="Open"||t.status==="Acknowledged").sort((a,b)=>{const po={urgent:0,high:1,normal:2};return(po[a.priority]||2)-(po[b.priority]||2)||b.createdAt.localeCompare(a.createdAt);});
 const recentActivity=jobs.filter(j=>scopeFilter(j)&&j.production?.submittedAt).sort((a,b)=>b.production.submittedAt.localeCompare(a.production.submittedAt)).slice(0,8);

 const[detailPanel,setDetailPanel]=useState(null);

 return <div>
 {/* ── HEADER ── */}
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
 <div>
 <div style={{fontSize:10,color:T.purple,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Client Portal</div>
 <h1 style={{fontSize:22,fontWeight:600,margin:0,color:T.text}}>{scope.customer||scope.client}</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{scope.client}{scope.regions?` · ${scope.regions.join(", ")}`:""} · {d.clientJobs.length} jobs · {periodLabels[period]}</p>
 </div>
 <div style={{display:"flex",gap:6,alignItems:"center"}}>
 <div style={{display:"flex",borderRadius:4,overflow:"hidden",border:`1px solid ${T.border}`}}>
 {[{k:"week",l:"W"},{k:"month",l:"M"},{k:"year",l:"Y"},{k:"all",l:"All"}].map(p=>
 <button key={p.k} onClick={()=>setPeriod(p.k)} style={{padding:"6px 12px",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:period===p.k?T.accent:"transparent",color:period===p.k?"#fff":T.textMuted}}>{p.l}</button>
 )}
 </div>
 </div>
 </div>

 {/* ── BUILD PROGRESS BAR — always visible, clickable to expand ── */}
 <div style={{marginBottom:16,padding:"14px 18px",background:`linear-gradient(135deg, ${T.bgCard}, ${T.accent}06)`,borderRadius:6,border:`1px solid ${T.border}`,cursor:"pointer",transition:"all 0.15s"}} onClick={()=>setDetailPanel(detailPanel==="progress"?null:"progress")}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <span style={{fontSize:13,fontWeight:600,color:T.text}}>Build Progress</span>
 <Badge label={onPace?"On Pace":"Behind Pace"} color={onPace?T.success:T.danger} bg={(onPace?T.success:T.danger)+"18"}/>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:16,fontSize:12}}>
 <span style={{color:T.textMuted}}><b style={{color:T.text}}>{(d.allTimeFeet/1000).toFixed(0)}k</b> / {(projectTarget/1000).toFixed(0)}k ft</span>
 <span style={{color:T.textMuted}}>{projectPct.toFixed(1)}%</span>
 <span style={{color:T.accent,fontSize:10,transition:"transform 0.2s",display:"inline-block",transform:detailPanel==="progress"?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
 </div>
 </div>
 <div style={{height:8,borderRadius:4,background:T.bgInput,overflow:"hidden"}}>
 <div style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg, ${T.accent}, ${T.success})`,width:`${projectPct}%`,transition:"width 0.5s"}}/>
 </div>
 </div>

 {/* ── EXPANDED PROGRESS DETAIL ── */}
 {detailPanel==="progress"&&<Card style={{marginBottom:16,padding:20}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
 <h3 style={{fontSize:14,fontWeight:600,color:T.text,margin:0}}>Weekly Production Trend</h3>
 <button onClick={(e)=>{e.stopPropagation();setDetailPanel(null);}} style={{background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:14,padding:"2px 6px"}}>✕</button>
 </div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>4-week avg: <b style={{color:T.text}}>{(recentWeekAvg/1000).toFixed(1)}k ft/wk</b> {onPace?<span style={{color:T.success}}>— above pace</span>:<span style={{color:T.danger}}>— below {(paceNeeded/1000).toFixed(1)}k/wk target</span>}</div>
 <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100,marginBottom:12}}>
 {d.weeklyTrend.map((w,i)=>{const h=maxWeekFt>0?(w.feet/maxWeekFt)*100:0;
 return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
 <div style={{fontSize:9,fontWeight:600,color:T.text}}>{w.feet>=1000?`${(w.feet/1000).toFixed(1)}k`:w.feet}</div>
 <div style={{width:"100%",height:`${Math.max(h,2)}%`,borderRadius:4,background:w.feet>=paceNeeded?T.success:w.feet>0?T.warning:T.bgInput,transition:"height 0.3s"}}/>
 <div style={{fontSize:8,color:T.textDim}}>{w.label}</div>
 </div>;})}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
 <div style={{padding:10,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:18,fontWeight:600,color:T.text}}>{(d.allTimeFeet/1000).toFixed(0)}k</div><div style={{fontSize:9,color:T.textMuted}}>Built to Date</div></div>
 <div style={{padding:10,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:18,fontWeight:600,color:T.warning}}>{((projectTarget-d.allTimeFeet)/1000).toFixed(0)}k</div><div style={{fontSize:9,color:T.textMuted}}>Remaining</div></div>
 <div style={{padding:10,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:18,fontWeight:600,color:onPace?T.success:T.danger}}>{(paceNeeded/1000).toFixed(1)}k</div><div style={{fontSize:9,color:T.textMuted}}>Needed / Week</div></div>
 </div>
 </Card>}

 {/* ── ACTION ZONE: 2 columns — the heart of the dashboard ── */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

 {/* LEFT: Review Queue */}
 <Card style={{padding:0,overflow:"hidden"}}>
 <div onClick={()=>navigateTo("redline_review")} style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",transition:"background 0.12s"}} className="card-hover">
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:6,height:32,borderRadius:3,background:reviewQueue.length>0?T.accent:T.border}}/>
 <div>
 <div style={{fontSize:13,fontWeight:700,color:T.text}}>Awaiting Your Review</div>
 <div style={{fontSize:11,color:T.textMuted}}>{reviewQueue.length} job{reviewQueue.length!==1?"s":""} need approval</div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 {reviewQueue.length>0&&<span style={{fontSize:18,fontWeight:700,color:T.accent}}>{reviewQueue.length}</span>}
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
 </div>
 </div>
 <div style={{maxHeight:320,overflowY:"auto"}}>
 {reviewQueue.length===0&&<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:13,color:T.textMuted,fontWeight:600}}>All caught up</div><div style={{fontSize:11,color:T.textDim,marginTop:4}}>No jobs awaiting review.</div></div>}
 {reviewQueue.map(j=>{
 const daysPending=Math.round((now-new Date(j.production?.submittedAt||j.updatedAt))/86400000);
 const urgent=daysPending>=3;
 return <div key={j.id} className="card-hover" onClick={()=>{setSelectedJob(j);setView("job_detail");}} style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <span style={{fontSize:12,fontWeight:700,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</span>
 {urgent&&<span style={{fontSize:9,fontWeight:700,color:T.danger,background:T.dangerSoft,padding:"1px 5px",borderRadius:3}}>{daysPending}d waiting</span>}
 </div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{j.customer} · {j.region} · {j.production?.totalFeet?.toLocaleString()||0} ft</div>
 </div>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
 </div>;})}
 </div>
 </Card>

 {/* RIGHT: Open Tickets */}
 <Card style={{padding:0,overflow:"hidden"}}>
 <div onClick={()=>navigateTo("tickets")} style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",transition:"background 0.12s"}} className="card-hover">
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:6,height:32,borderRadius:3,background:activeTickets.length>0?T.accent:T.border}}/>
 <div>
 <div style={{fontSize:13,fontWeight:700,color:T.text}}>Open Tickets</div>
 <div style={{fontSize:11,color:T.textMuted}}>{activeTickets.length} need attention</div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 {activeTickets.length>0&&<span style={{fontSize:18,fontWeight:700,color:T.accent}}>{activeTickets.length}</span>}
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
 </div>
 </div>
 <div style={{maxHeight:320,overflowY:"auto"}}>
 {activeTickets.length===0&&<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:13,color:T.textMuted,fontWeight:600}}>No open tickets</div><div style={{fontSize:11,color:T.textDim,marginTop:4}}>Everything looks clear.</div></div>}
 {activeTickets.map(t=>{
 const prc=TPC[t.priority]||TPC.normal;
 const stc=TSC[t.status]||{c:T.textMuted,bg:"transparent"};
 const lastMsg=t.messages[t.messages.length-1];
 const hrs=Math.round((now-new Date(lastMsg.ts))/3600000);
 const ago=hrs<1?"now":hrs<24?hrs+"h":Math.round(hrs/24)+"d";
 return <div key={t.id} className="card-hover" onClick={()=>navigateTo("tickets")} style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 {t.priority!=="normal"&&<span style={{fontSize:8,fontWeight:700,color:prc.c,background:prc.c+"18",padding:"1px 4px",borderRadius:3}}>{prc.l}</span>}
 <span style={{fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject}</span>
 </div>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{t.region} · {t.createdBy} · {ago}</div>
 </div>
 <Badge label={t.status} color={stc.c} bg={stc.bg}/>
 </div>;})}
 </div>
 </Card>
 </div>

 {/* ── METRICS ROW ── */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Production Value</div><div style={{fontSize:22,fontWeight:600,color:T.success,marginTop:4}}>{$(d.tRev)}</div><div style={{fontSize:10,color:T.textDim}}>{periodLabels[period]} · {d.calcCount} jobs</div></Card>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Footage Built</div><div style={{fontSize:22,fontWeight:600,color:T.text,marginTop:4}}>{d.tFeet>=1000?`${(d.tFeet/1000).toFixed(1)}k`:d.tFeet} ft</div><div style={{fontSize:10,color:T.textDim}}>{d.calcCount} jobs</div></Card>
 <Card hover onClick={()=>navigateTo("client_jobs","Ready to Invoice")} style={{padding:14,cursor:"pointer"}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Ready to Invoice</div><div style={{fontSize:22,fontWeight:600,color:"#FACC15",marginTop:4}}>{d.readyToInvoice}</div><div style={{fontSize:10,color:T.textDim}}>{d.billed} billed</div></Card>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Avg $/Foot</div><div style={{fontSize:22,fontWeight:600,color:T.text,marginTop:4}}>${d.avgCostPerFt.toFixed(2)}</div><div style={{fontSize:10,color:T.textDim}}>across all regions</div></Card>
 </div>

 {/* ── Recent Production ── */}
 <Card style={{padding:0,overflow:"hidden",marginBottom:16}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <h3 style={{fontSize:13,fontWeight:600,color:T.text,margin:0}}>Recent Production</h3>
 </div>
 <div style={{maxHeight:280,overflowY:"auto"}}>
 {recentActivity.length===0&&<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:13,color:T.textMuted}}>No recent production</div></div>}
 {recentActivity.map(j=>{
 const crew=USERS.find(u=>u.id===j.production.submittedBy);
 const hrs2=Math.round((now-new Date(j.production.submittedAt))/3600000);
 const ago2=hrs2<1?"now":hrs2<24?hrs2+"h":Math.round(hrs2/24)+"d";
 return <div key={j.id} className="card-hover" onClick={()=>{setSelectedJob(j);setView("job_detail");}} style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer",display:"flex",gap:10,alignItems:"center"}}>
 <div style={{width:28,height:28,borderRadius:6,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:T.accent,flexShrink:0}}>{(crew?.name||"?").split(" ").map(n=>n[0]).join("")}</div>
 <div style={{flex:1,minWidth:0}}>
 <div style={{fontSize:12,color:T.text}}><b style={{color:T.accent,fontFamily:"monospace"}}>{j.feederId}</b> · {j.production.totalFeet?.toLocaleString()} ft</div>
 <div style={{fontSize:10,color:T.textDim}}>{crew?.name} · {j.region}{j.subcontractor?` · ${j.subcontractor}`:""}</div>
 </div>
 <span style={{fontSize:10,color:T.textDim}}>{ago2}</span>
 </div>;})}
 </div>
 </Card>

 {/* ── TODAY'S UPDATES — only if there's activity ── */}
 {todayTickets.length>0&&<Card style={{marginTop:16,padding:0,overflow:"hidden",borderLeft:`3px solid ${T.accent}`}}>
 <div onClick={()=>navigateTo("tickets")} style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} className="card-hover">
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>Updates Today</div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{fontSize:11,color:T.textMuted}}>{todayTickets.length} ticket{todayTickets.length!==1?"s":""} with activity</span>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
 </div>
 </div>
 {todayTickets.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3).map(t=>{const stc=TSC[t.status]||{c:T.textMuted,bg:"transparent"};const todayMsgs=t.messages.filter(m=>m.ts.split("T")[0]===todayStr);const lastTodayMsg=todayMsgs[todayMsgs.length-1];
 return <div key={t.id} className="card-hover" onClick={()=>navigateTo("tickets")} style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer",display:"flex",gap:10,alignItems:"center"}}>
 <span style={{width:8,height:8,borderRadius:4,background:stc.c,flexShrink:0}}/>
 <div style={{flex:1,minWidth:0}}>
 <div style={{fontSize:12,fontWeight:600,color:T.text}}>{t.subject}</div>
 {lastTodayMsg&&<div style={{fontSize:11,color:T.textDim,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastTodayMsg.from}: {lastTodayMsg.text.slice(0,80)}</div>}
 </div>
 <Badge label={t.status} color={stc.c} bg={stc.bg}/>
 </div>;})}
 </Card>}
 </div>;
}

// ─── CLIENT JOBS VIEW (Client Manager — read-only jobs view) ─────────────
function ClientJobsView(){
 const{jobs,rateCards,currentUser,setSelectedJob,setView,clientSubFilter,setClientDetailOpen,jobsPreFilter,setJobsPreFilter}=useApp();
 const scope=currentUser.scope||{};
 const scopeFilter=(j)=>j.client===scope.client&&(!scope.customer||j.customer===scope.customer)&&(!scope.regions||scope.regions.includes(j.region))&&(clientSubFilter==="all"||j.subcontractor===clientSubFilter);
 const clientJobs=jobs.filter(scopeFilter);
 const[statusFilter,setStatusFilter]=useState(jobsPreFilter||"all");
 const[regionFilter,setRegionFilter]=useState("all");
 const[searchTerm,setSearchTerm]=useState("");
 const[expandedJobId,setExpandedJobId]=useState(null);
 React.useEffect(()=>{setClientDetailOpen(!!expandedJobId);return()=>setClientDetailOpen(false);},[expandedJobId]);
 React.useEffect(()=>{if(jobsPreFilter){setStatusFilter(jobsPreFilter);setJobsPreFilter("");};},[]);
 const now=new Date();

 const regions=[...new Set(clientJobs.map(j=>j.region))];
 const statuses=[...new Set(clientJobs.map(j=>j.status))];

 const filtered=clientJobs.filter(j=>{
 if(statusFilter!=="all"&&j.status!==statusFilter)return false;
 if(regionFilter!=="all"&&j.region!==regionFilter)return false;
 if(searchTerm){const s=searchTerm.toLowerCase();if(!j.feederId.toLowerCase().includes(s)&&!j.olt.toLowerCase().includes(s)&&!j.location.toLowerCase().includes(s)&&!(USERS.find(u=>u.id===j.assignedLineman)?.name||"").toLowerCase().includes(s))return false;}
 return true;
 }).sort((a,b)=>{
 // Sort: pending review first, then by date
 const pa=a.status==="Under Client Review"?0:a.status==="Pending Redlines"?1:2;
 const pb=b.status==="Under Client Review"?0:b.status==="Pending Redlines"?1:2;
 if(pa!==pb)return pa-pb;
 return(b.scheduledDate||"").localeCompare(a.scheduledDate||"");
 });

 // Status counts
 const statusCounts={};clientJobs.forEach(j=>{statusCounts[j.status]=(statusCounts[j.status]||0)+1;});

 // Summary
 const totalFeet=clientJobs.filter(j=>j.production).reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 const completedCount=clientJobs.filter(j=>j.production).length;

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
  <div>
  <div style={{fontSize:10,color:T.purple,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Jobs Overview</div>
  <h1 style={{fontSize:22,fontWeight:600,margin:0,color:T.text}}>{scope.customer||scope.client} — {statusFilter!=="all"?statusFilter:"All Jobs"}</h1>
  <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{clientJobs.length} total · {completedCount} completed · {(totalFeet/1000).toFixed(0)}k ft built{scope.regions?` · ${scope.regions.join(", ")}`:""}</p>
  </div>
 </div>

 {/* Status summary chips */}
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
  <button onClick={()=>setStatusFilter("all")} style={{padding:"6px 14px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${statusFilter==="all"?T.accent:T.border}`,background:statusFilter==="all"?T.accentSoft:"transparent",color:statusFilter==="all"?T.accent:T.textMuted}}>All ({clientJobs.length})</button>
  {statuses.sort().map(s=>{const sc=STATUS_CFG[s]||{c:T.textMuted};
  return <button key={s} onClick={()=>setStatusFilter(statusFilter===s?"all":s)} style={{padding:"6px 14px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${statusFilter===s?sc.c:T.border}`,background:statusFilter===s?sc.c+"15":"transparent",color:statusFilter===s?sc.c:T.textMuted}}>{s} ({statusCounts[s]||0})</button>;
  })}
 </div>

 {/* Filters row */}
 <div style={{display:"flex",gap:8,marginBottom:16}}>
  <div style={{position:"relative",flex:1}}>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
  <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search feeder, OLT, location, crew..." style={{width:"100%",padding:"8px 12px 8px 32px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/>
  </div>
  <select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)} style={{padding:"8px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>
  <option value="all">All Regions</option>
  {regions.map(r=><option key={r} value={r}>{r}</option>)}
  </select>
 </div>

 {/* Jobs table */}
 <Card style={{padding:0,overflow:"hidden"}}>
  <div style={{overflowX:"auto"}}>
  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
   <thead><tr style={{background:T.bgInput}}>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Feeder</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Sub</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>OLT</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Region</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Work Type</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Crew</th>
   <th style={{padding:"10px 14px",textAlign:"right",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Footage</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Status</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Redline</th>
   <th style={{padding:"10px 14px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Date</th>
   </tr></thead>
   <tbody>
   {filtered.length===0&&<tr><td colSpan={10} style={{padding:40,textAlign:"center",color:T.textDim}}>No jobs match your filters</td></tr>}
   {filtered.map(j=>{
   const crew=USERS.find(u=>u.id===j.assignedLineman);
   const sc=STATUS_CFG[j.status]||{c:T.textMuted,bg:"transparent"};
   const rlc=REDLINE_CFG[j.redlineStatus]||{c:T.textDim,bg:"transparent"};
   const feet=j.production?.totalFeet||j.estimatedFootage||0;
   const isCompleted=!!j.production;
   const isExp=expandedJobId===j.id;
   return <React.Fragment key={j.id}>
   <tr className="card-hover" onClick={()=>setExpandedJobId(isExp?null:j.id)} style={{borderBottom:isExp?"none":`1px solid ${T.border}08`,cursor:"pointer",background:isExp?T.accentSoft:"transparent"}}>
    <td style={{padding:"10px 14px"}}><span style={{fontFamily:"monospace",fontWeight:700,color:T.accent}}>{j.feederId}</span></td>
    <td style={{padding:"10px 14px",fontSize:11,color:T.textMuted}}>{j.subcontractor||"—"}</td>
    <td style={{padding:"10px 14px",color:T.textMuted,fontSize:11}}>{j.olt}</td>
    <td style={{padding:"10px 14px",color:T.textMuted}}>{j.region}</td>
    <td style={{padding:"10px 14px",color:T.textMuted}}>{j.workType}</td>
    <td style={{padding:"10px 14px",color:T.text}}>{crew?.name||<span style={{color:T.textDim}}>Unassigned</span>}</td>
    <td style={{padding:"10px 14px",textAlign:"right",fontWeight:600,color:isCompleted?T.text:T.textDim}}>{feet>=1000?`${(feet/1000).toFixed(1)}k`:feet}{!isCompleted&&<span style={{fontSize:9,color:T.textDim}}> est</span>}</td>
    <td style={{padding:"10px 14px"}}><Badge label={j.status} color={sc.c} bg={sc.bg}/></td>
    <td style={{padding:"10px 14px"}}><Badge label={j.redlineStatus} color={rlc.c} bg={rlc.bg}/></td>
    <td style={{padding:"10px 14px",color:T.textDim,fontSize:11}}>{fd(j.scheduledDate)}</td>
   </tr>
   {isExp&&<tr><td colSpan={10} style={{padding:0,borderBottom:`1px solid ${T.border}`}}><JobDetail job={j} inline/></td></tr>}
   </React.Fragment>;
   })}
   </tbody>
  </table>
  </div>
 </Card>
 </div>;
}

// ─── CREW VISIBILITY (Client Manager) ────────────────────────────────────────
function CrewVisibilityView(){
 const{jobs,currentUser,trucks,clientSubFilter,setClientDetailOpen}=useApp();
 const scope=currentUser.scope||{};
 const now=new Date();
 const todayStr=now.toISOString().split("T")[0];
 const[selRegion,setSelRegion]=useState("all");
 const[selCrew,setSelCrew]=useState(null);
 React.useEffect(()=>{setClientDetailOpen(!!selCrew);return()=>setClientDetailOpen(false);},[selCrew]);

 const scopeFilter=(j)=>j.client===scope.client&&(!scope.customer||j.customer===scope.customer)&&(!scope.regions||scope.regions.includes(j.region))&&(clientSubFilter==="all"||j.subcontractor===clientSubFilter);
 const clientJobs=jobs.filter(scopeFilter);

 // Build crew roster with today's assignment info
 const crews=useMemo(()=>{
 const crewMap={};
 // All linemen and foremen who have jobs for this client
 clientJobs.forEach(j=>{
  if(!j.assignedLineman)return;
  const user=USERS.find(u=>u.id===j.assignedLineman);
  if(!user)return;
  if(!crewMap[user.id])crewMap[user.id]={user,todayJobs:[],upcomingJobs:[],completedJobs:[],totalFeet:0,truck:null,regions:new Set(),olts:new Set()};
  const crew=crewMap[user.id];
  crew.regions.add(j.region);
  crew.olts.add(j.olt);
  if(j.assignedTruck&&!crew.truck)crew.truck=trucks.find(t=>t.id===j.assignedTruck);
  if(j.scheduledDate===todayStr&&!j.production)crew.todayJobs.push(j);
  else if(j.scheduledDate>todayStr&&!j.production)crew.upcomingJobs.push(j);
  if(j.production){crew.completedJobs.push(j);crew.totalFeet+=j.production.totalFeet||0;}
 });
 return Object.values(crewMap).sort((a,b)=>b.todayJobs.length-a.todayJobs.length);
 },[clientJobs,trucks,todayStr]);

 const regions=[...new Set(clientJobs.map(j=>j.region))];
 const filteredCrews=selRegion==="all"?crews:crews.filter(c=>c.regions.has(selRegion));

 // Today's summary
 const totalFieldToday=crews.filter(c=>c.todayJobs.length>0).length;
 const totalJobsToday=crews.reduce((s,c)=>s+c.todayJobs.length,0);
 const activeOlts=new Set();crews.forEach(c=>c.todayJobs.forEach(j=>activeOlts.add(j.olt)));

 // Status helpers
 const crewStatus=(c)=>{
  if(c.todayJobs.length>0)return{label:"In Field",color:T.success,bg:T.successSoft};
  if(c.upcomingJobs.length>0)return{label:"Scheduled",color:T.warning,bg:T.warningSoft};
  return{label:"No Assignment",color:T.textDim,bg:"rgba(71,85,105,0.15)"};
 };

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
  <div>
  <div style={{fontSize:10,color:T.purple,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Crew Visibility</div>
  <h1 style={{fontSize:22,fontWeight:600,margin:0,color:T.text}}>Today's Field Activity</h1>
  <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{fd(todayStr)} · {scope.customer||scope.client}{scope.regions?` · ${scope.regions.join(", ")}`:""}</p>
  </div>
  <div style={{display:"flex",gap:6}}>
  <select value={selRegion} onChange={e=>setSelRegion(e.target.value)} style={{padding:"7px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>
   <option value="all">All Regions</option>
   {regions.map(r=><option key={r} value={r}>{r}</option>)}
  </select>
  </div>
 </div>

 {/* Summary cards */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
  <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Crews in Field</div><div style={{fontSize:24,fontWeight:600,color:T.success,marginTop:4}}>{totalFieldToday}</div><div style={{fontSize:10,color:T.textDim}}>of {crews.length} total</div></Card>
  <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Jobs Today</div><div style={{fontSize:24,fontWeight:600,color:T.text,marginTop:4}}>{totalJobsToday}</div><div style={{fontSize:10,color:T.textDim}}>scheduled</div></Card>
  <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Active OLTs</div><div style={{fontSize:24,fontWeight:600,color:T.accent,marginTop:4}}>{activeOlts.size}</div><div style={{fontSize:10,color:T.textDim}}>{[...activeOlts].join(", ")||"None"}</div></Card>
  <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3}}>Regions Active</div><div style={{fontSize:24,fontWeight:600,color:T.text,marginTop:4}}>{new Set(crews.filter(c=>c.todayJobs.length>0).flatMap(c=>[...c.regions])).size}</div><div style={{fontSize:10,color:T.textDim}}>with crews deployed</div></Card>
 </div>

 {/* Crew cards */}
 {filteredCrews.length===0&&<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:T.textDim}}>No crews assigned for this client{selRegion!=="all"?` in ${selRegion}`:""}</div></Card>}

 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))",gap:12}}>
 {filteredCrews.map(c=>{
  const st=crewStatus(c);
  const isExpanded=selCrew===c.user.id;
  return <Card key={c.user.id} style={{padding:0,overflow:"hidden",cursor:"pointer",borderLeft:`3px solid ${st.color}`}} onClick={()=>setSelCrew(isExpanded?null:c.user.id)}>
  <div style={{padding:"14px 18px"}}>
   {/* Header */}
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
   <div style={{display:"flex",alignItems:"center",gap:10}}>
    <div style={{width:36,height:36,borderRadius:"50%",background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.accent}}>
    {c.user.name.split(" ").map(n=>n[0]).join("")}
    </div>
    <div>
    <div style={{fontSize:14,fontWeight:600,color:T.text}}>{c.user.name}</div>
    <div style={{fontSize:11,color:T.textMuted}}>{c.user.role==="foreman"?"Foreman":"Lineman"}{c.truck?` · ${c.truck.id}`:""}</div>
    </div>
   </div>
   <Badge label={st.label} color={st.color} bg={st.bg}/>
   </div>

   {/* Today's assignments */}
   {c.todayJobs.length>0?<div>
   <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3,marginBottom:6}}>Today's Work</div>
   {c.todayJobs.map(j=><div key={j.id} style={{padding:"8px 10px",background:T.bgInput,borderRadius:4,marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <div>
    <span style={{fontSize:12,fontWeight:700,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</span>
    <span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{j.workType} · {j.estimatedFootage?.toLocaleString()} ft est.</span>
    </div>
    <span style={{fontSize:10,color:T.textDim}}>{j.olt}</span>
   </div>)}
   </div>
   :<div style={{fontSize:12,color:T.textDim}}>No jobs scheduled today</div>}

   {/* Quick stats row */}
   <div style={{display:"flex",gap:12,marginTop:10,fontSize:11}}>
   <span style={{color:T.textMuted}}>Region: <b style={{color:T.text}}>{[...c.regions].join(", ")}</b></span>
   <span style={{color:T.textMuted}}>Completed: <b style={{color:T.text}}>{c.completedJobs.length}</b></span>
   <span style={{color:T.textMuted}}>Total: <b style={{color:T.text}}>{c.totalFeet>=1000?`${(c.totalFeet/1000).toFixed(1)}k`:c.totalFeet} ft</b></span>
   </div>
  </div>

  {/* Expanded detail */}
  {isExpanded&&<div style={{borderTop:`1px solid ${T.border}`,padding:"14px 18px",background:T.accentSoft}}>
   {c.truck&&<div style={{marginBottom:10}}>
   <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3,marginBottom:4}}>Vehicle</div>
   <div style={{fontSize:12,color:T.text}}>{c.truck.label}</div>
   <div style={{fontSize:10,color:T.textDim}}>VIN: {c.truck.vin} · Owner: {c.truck.investorName||"Company"}</div>
   </div>}
   {c.upcomingJobs.length>0&&<div>
   <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3,marginBottom:4}}>Upcoming ({c.upcomingJobs.length})</div>
   {c.upcomingJobs.slice(0,5).map(j=><div key={j.id} style={{fontSize:11,color:T.textMuted,padding:"3px 0"}}>
    <span style={{fontFamily:"monospace",color:T.accent,fontWeight:600}}>{j.feederId}</span> · {j.workType} · {fd(j.scheduledDate)} · {j.olt}
   </div>)}
   </div>}
   <div style={{marginTop:8}}>
   <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3,marginBottom:4}}>OLT Coverage</div>
   <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
    {[...c.olts].map(o=><Badge key={o} label={o} color={T.accent} bg={T.accentSoft}/>)}
   </div>
   </div>
  </div>}
  </Card>;
 })}
 </div>
 </div>;
}

// ─── REDLINE REVIEW (Client Manager) ─────────────────────────────────────────
function RedlineReviewView(){
 const{jobs,setJobs,currentUser,setSelectedJob,setView,rateCards,trucks,clientSubFilter,setClientDetailOpen}=useApp();
 const scope=currentUser.scope||{};
 const now=new Date();
 const[tab,setTab]=useState("pending");
 const[selJob,setSelJob]=useState(null);
 const[reviewNote,setReviewNote]=useState("");
 React.useEffect(()=>{setClientDetailOpen(!!selJob);return()=>setClientDetailOpen(false);},[selJob]);

 // Jobs with redlines that belong to this client's scope
 const scopeFilter=(j)=>j.client===scope.client&&(!scope.customer||j.customer===scope.customer)&&(!scope.regions||scope.regions.includes(j.region))&&(clientSubFilter==="all"||j.subcontractor===clientSubFilter);
 const redlineJobs=useMemo(()=>{
 return jobs.filter(j=>scopeFilter(j)&&j.redlines&&j.redlines.length>0)
  .sort((a,b)=>(b.redlines[b.redlines.length-1]?.uploadedAt||"").localeCompare(a.redlines[a.redlines.length-1]?.uploadedAt||""));
 },[jobs,scope]);

 const pending=redlineJobs.filter(j=>j.status==="Under Client Review");
 const approved=redlineJobs.filter(j=>j.redlineStatus==="Approved");
 const rejected=redlineJobs.filter(j=>j.redlineStatus==="Rejected");
 const allWithRedlines=redlineJobs;

 const lists={pending,approved,rejected,all:allWithRedlines};
 const currentList=lists[tab]||pending;

 const approveJob=(jobId)=>{
 setJobs(prev=>prev.map(j=>j.id===jobId?{...j,status:"Ready to Invoice",redlineStatus:"Approved",activityLog:[...(j.activityLog||[]),{action:"client_approved",actor:currentUser.id,actorName:currentUser.name,ts:now.toISOString(),detail:reviewNote||"Approved by client manager.",from:"Under Client Review",to:"Ready to Invoice"}]}:j));
 setReviewNote("");setSelJob(null);
 };

 const rejectJob=(jobId)=>{
 if(!reviewNote.trim())return;
 setJobs(prev=>prev.map(j=>j.id===jobId?{...j,status:"Rejected",redlineStatus:"Rejected",activityLog:[...(j.activityLog||[]),{action:"client_rejected",actor:currentUser.id,actorName:currentUser.name,ts:now.toISOString(),detail:reviewNote,from:"Under Client Review",to:"Rejected"}]}:j));
 setReviewNote("");setSelJob(null);
 };

 const activeJob=selJob?jobs.find(j=>j.id===selJob):null;
 const activeRedline=activeJob?.redlines?.[activeJob.redlines.length-1];
 const activeFinancials=activeJob?calcJob(activeJob,rateCards):null;

 // Detailed review panel
 if(activeJob){
 const crew=USERS.find(u=>u.id===activeJob.assignedLineman);
 const truck=trucks.find(t=>t.id===activeJob.assignedTruck);
 const daysSinceSubmit=activeRedline?Math.round((now-new Date(activeRedline.uploadedAt))/86400000):0;
 const spans=activeJob.production?.spans||activeJob.confirmedTotals?.spans||[];

 return <div>
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
  <Btn v="ghost" sz="sm" onClick={()=>{setSelJob(null);setReviewNote("");}}>← Back to Queue</Btn>
  <div style={{flex:1}}>
   <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{activeJob.feederId}</h2>
   <div style={{fontSize:12,color:T.textMuted}}>{activeJob.customer} · {activeJob.region} · {activeJob.olt}</div>
  </div>
  <Badge label={activeJob.redlineStatus} color={REDLINE_CFG[activeJob.redlineStatus]?.c||T.textMuted} bg={REDLINE_CFG[activeJob.redlineStatus]?.bg||"transparent"}/>
  </div>

  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
  {/* Left: Redline document info */}
  <Card style={{padding:0,overflow:"hidden"}}>
   <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,background:T.accentSoft}}>
   <div style={{fontSize:13,fontWeight:600,color:T.text}}>Redline Document</div>
   </div>
   <div style={{padding:"16px 18px"}}>
   <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:T.bgInput,borderRadius:6,marginBottom:12}}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    <div style={{flex:1}}>
    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{activeRedline?.fileName||"No file"}</div>
    <div style={{fontSize:11,color:T.textMuted}}>Version {activeRedline?.version||1} · Uploaded {activeRedline?fd(activeRedline.uploadedAt.split("T")[0]):"N/A"}</div>
    </div>
    <span style={{fontSize:10,color:T.warning,fontWeight:600}}>{daysSinceSubmit}d ago</span>
   </div>
   {activeRedline?.notes&&<div style={{fontSize:12,color:T.textMuted,padding:"8px 12px",background:T.bgInput,borderRadius:4,borderLeft:`3px solid ${T.purple}`,marginBottom:12}}>
    <div style={{fontSize:10,color:T.purple,fontWeight:600,marginBottom:2}}>Redline Specialist Notes</div>
    {activeRedline.notes}
   </div>}
   <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3,marginBottom:6}}>Uploaded By</div>
   <div style={{fontSize:12,color:T.text}}>{USERS.find(u=>u.id===activeRedline?.uploadedBy)?.name||"Unknown"}</div>
   <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3,marginTop:12,marginBottom:6}}>Crew</div>
   <div style={{fontSize:12,color:T.text}}>{crew?.name||"Unassigned"}{truck?` · ${truck.id}`:""}</div>
   </div>
  </Card>

  {/* Right: Production summary */}
  <Card style={{padding:0,overflow:"hidden"}}>
   <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,background:T.accentSoft}}>
   <div style={{fontSize:13,fontWeight:600,color:T.text}}>Production Summary</div>
   </div>
   <div style={{padding:"16px 18px"}}>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
    <div style={{padding:10,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:18,fontWeight:600,color:T.text}}>{(activeJob.production?.totalFeet||0).toLocaleString()}</div><div style={{fontSize:9,color:T.textMuted}}>Total Feet</div></div>
    <div style={{padding:10,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:18,fontWeight:600,color:T.text}}>{spans.length}</div><div style={{fontSize:9,color:T.textMuted}}>Spans</div></div>
   </div>
   {activeFinancials?.status==="Calculated"&&activeFinancials.totals&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
    <div style={{padding:10,background:T.moneySoft,borderRadius:4,textAlign:"center"}}><div style={{fontSize:18,fontWeight:600,color:T.money}}>{$(activeFinancials.totals.nextgenRevenue)}</div><div style={{fontSize:9,color:T.textMuted}}>Invoice Value</div></div>
    <div style={{padding:10,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:18,fontWeight:600,color:T.text}}>${activeFinancials.totals.nextgenRevenue&&activeJob.production?.totalFeet?(activeFinancials.totals.nextgenRevenue/activeJob.production.totalFeet).toFixed(2):"—"}</div><div style={{fontSize:9,color:T.textMuted}}>$/Foot</div></div>
   </div>}
   {/* Work type breakdown */}
   <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3,marginBottom:6}}>Work Types</div>
   {activeJob.production?.workBreakdown?Object.entries(activeJob.production.workBreakdown).map(([wt,ft])=>
    <div key={wt} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12,borderBottom:`1px solid ${T.border}08`}}>
    <span style={{color:T.textMuted}}>{wt}</span>
    <span style={{color:T.text,fontWeight:600}}>{ft.toLocaleString()} ft</span>
    </div>
   ):<div style={{fontSize:12,color:T.textDim}}>{activeJob.workType} · {(activeJob.production?.totalFeet||0).toLocaleString()} ft</div>}
   </div>
  </Card>
  </div>

  {/* Span detail table */}
  {spans.length>0&&<Card style={{padding:0,overflow:"hidden",marginBottom:16}}>
  <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,background:T.accentSoft}}>
   <div style={{fontSize:13,fontWeight:600,color:T.text}}>Span Detail ({spans.length})</div>
  </div>
  <div style={{overflowX:"auto"}}>
   <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
   <thead><tr style={{background:T.bgInput}}>
    <th style={{padding:"8px 12px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Poles</th>
    <th style={{padding:"8px 12px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Work Types</th>
    <th style={{padding:"8px 12px",textAlign:"right",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Footage</th>
    <th style={{padding:"8px 12px",textAlign:"center",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase"}}>Hardware</th>
   </tr></thead>
   <tbody>{spans.map((sp,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}08`}}>
    <td style={{padding:"8px 12px",color:T.text,fontFamily:"monospace",fontWeight:600}}>{sp.fromPole||"—"} → {sp.toPole||"—"}</td>
    <td style={{padding:"8px 12px",color:T.textMuted}}>{(sp.workTypes||[sp.workType||activeJob.workType]).join(", ")}</td>
    <td style={{padding:"8px 12px",textAlign:"right",color:T.text,fontWeight:600}}>{(sp.strandSpan||sp.footage||0).toLocaleString()}</td>
    <td style={{padding:"8px 12px",textAlign:"center",color:T.textDim,fontSize:11}}>{[sp.anchor&&"Anchor",sp.coil&&"Coil",sp.snowshoe&&"Snowshoe"].filter(Boolean).join(", ")||"—"}</td>
   </tr>)}</tbody>
   </table>
  </div>
  </Card>}

  {/* Action panel */}
  {activeJob.status==="Under Client Review"&&<Card style={{padding:18,border:`1px solid ${T.accent}33`}}>
  <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>Review Decision</div>
  <textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Add notes (required for rejection, optional for approval)..." rows={3} style={{width:"100%",padding:"10px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:13,resize:"vertical",boxSizing:"border-box",marginBottom:12}}/>
  <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
   <button onClick={()=>rejectJob(activeJob.id)} disabled={!reviewNote.trim()} style={{padding:"10px 24px",borderRadius:4,border:`1px solid ${T.danger}`,background:reviewNote.trim()?T.dangerSoft:"transparent",color:reviewNote.trim()?T.danger:T.textDim,fontSize:13,fontWeight:600,cursor:reviewNote.trim()?"pointer":"default",opacity:reviewNote.trim()?1:0.5}}>Reject</button>
   <button onClick={()=>approveJob(activeJob.id)} style={{padding:"10px 24px",borderRadius:4,border:"none",background:T.success,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Approve</button>
  </div>
  </Card>}

  {activeJob.status!=="Under Client Review"&&<Card style={{padding:18,textAlign:"center"}}>
  <div style={{fontSize:13,color:T.textMuted}}>This job has been <b style={{color:activeJob.redlineStatus==="Approved"?T.success:T.danger}}>{activeJob.redlineStatus==="Approved"?"approved":"rejected"}</b></div>
  {(activeJob.activityLog||[]).filter(a=>a.action==="client_approved"||a.action==="client_rejected").slice(-1).map((a,i)=>
   <div key={i} style={{fontSize:11,color:T.textDim,marginTop:4}}>{a.actorName} · {fd(a.ts.split("T")[0])} — "{a.detail}"</div>
  )}
  </Card>}
 </div>;
 }

 // Queue list view
 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
  <div>
  <div style={{fontSize:10,color:T.purple,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Redline Review</div>
  <h1 style={{fontSize:22,fontWeight:600,margin:0,color:T.text}}>Construction Documentation</h1>
  <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{pending.length} awaiting review · {approved.length} approved · {rejected.length} rejected</p>
  </div>
 </div>

 {/* Tabs */}
 <div style={{display:"flex",gap:4,marginBottom:16}}>
  {[{k:"pending",l:`Pending Review (${pending.length})`,c:pending.length>0?T.warning:T.textDim},{k:"approved",l:`Approved (${approved.length})`,c:T.success},{k:"rejected",l:`Rejected (${rejected.length})`,c:T.danger},{k:"all",l:`All (${allWithRedlines.length})`,c:T.textMuted}].map(t=>
  <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",borderRadius:4,border:`1px solid ${tab===t.k?t.c:T.border}`,background:tab===t.k?t.c+"15":"transparent",color:tab===t.k?t.c:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.12s"}}>{t.l}</button>
  )}
 </div>

 {/* Urgency banner for pending */}
 {tab==="pending"&&pending.length>0&&<div style={{padding:"10px 16px",background:T.warningSoft,borderRadius:6,marginBottom:12,display:"flex",alignItems:"center",gap:8,fontSize:12}}>
  <span style={{color:T.warning,fontWeight:700}}>⏱</span>
  <span style={{color:T.warning,fontWeight:500}}>{pending.filter(j=>{const rl=j.redlines[j.redlines.length-1];return rl&&Math.round((now-new Date(rl.uploadedAt))/86400000)>=3;}).length} redlines waiting 3+ days</span>
 </div>}

 {currentList.length===0&&<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:T.textDim}}>No redlines in this category</div></Card>}

 {currentList.map(j=>{
  const rl=j.redlines[j.redlines.length-1];
  const daysSince=rl?Math.round((now-new Date(rl.uploadedAt))/86400000):0;
  const urgent=daysSince>=3&&j.status==="Under Client Review";
  const crew=USERS.find(u=>u.id===j.assignedLineman);
  const rlCfg=REDLINE_CFG[j.redlineStatus]||{c:T.textMuted,bg:"transparent"};
  return <Card key={j.id} hover onClick={()=>{setSelJob(j.id);setReviewNote("");}} style={{marginBottom:8,padding:0,overflow:"hidden",cursor:"pointer",borderLeft:`3px solid ${rlCfg.c}`}}>
  <div style={{padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
   <div style={{flex:1,minWidth:0}}>
   <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
    <span style={{fontSize:13,fontWeight:700,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</span>
    {urgent&&<span style={{fontSize:9,fontWeight:700,color:T.danger,background:T.dangerSoft,padding:"2px 6px",borderRadius:3}}>{daysSince}d waiting</span>}
    <Badge label={j.redlineStatus} color={rlCfg.c} bg={rlCfg.bg}/>
   </div>
   <div style={{fontSize:12,color:T.textMuted}}>
    {j.customer} · {j.region} · {j.olt} · {(j.production?.totalFeet||0).toLocaleString()} ft · {crew?.name||"Unassigned"}
   </div>
   <div style={{fontSize:11,color:T.textDim,marginTop:3}}>
    {rl?.fileName} · v{rl?.version||1} · uploaded {rl?fd(rl.uploadedAt.split("T")[0]):"N/A"}
   </div>
   </div>
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
  </div>
  </Card>;
 })}
 </div>;
}

function ClientSubsView(){
 const{jobs,rateCards,currentUser,setClientSubFilter,setView}=useApp();
 const scope=currentUser.scope||{};
 const subs=[
 {name:"NextGen Fiber",contact:"Admin User",email:"admin@nextgenfiberllc.com",regions:["Alabama","Tennessee"],since:"2024-01-15"},
 {name:"Illuminate",contact:"Derek Vaughn",email:"derek@illuminatefiber.com",regions:["Alabama","Tennessee"],since:"2024-06-01"},
 ];
 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Subcontractors</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 16px"}}>Manage subcontractor relationships for {scope.customer||scope.client}{scope.regions?` · ${scope.regions.join(", ")}`:""}</p>
 {subs.map((s,i)=>{
 const subJobs=jobs.filter(j=>j.client===scope.client&&(!scope.customer||j.customer===scope.customer)&&(!scope.regions||scope.regions.includes(j.region))&&j.subcontractor===s.name);
 const completed=subJobs.filter(j=>j.production).length;
 const totalFeet=subJobs.reduce((acc,j)=>acc+(j.production?.totalFeet||0),0);
 const pendingReview=subJobs.filter(j=>j.status==="Under Client Review").length;
 const pendingRedlines=subJobs.filter(j=>j.status==="Pending Redlines").length;
 let totalRev=0;subJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals)totalRev+=f.totals.nextgenRevenue;});
 return <Card key={i} style={{padding:20,marginBottom:12}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
 <div>
 <div style={{fontSize:18,fontWeight:600,color:T.text}}>{s.name}</div>
 <div style={{fontSize:12,color:T.textMuted}}>Contact: {s.contact} · {s.email}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Partner since {fd(s.since)}</div>
 </div>
 <div style={{display:"flex",gap:6,alignItems:"center"}}>
 <Badge label="Active" color={T.success} bg={T.successSoft}/>
 <button onClick={()=>{setClientSubFilter(s.name);setView("client_portal");}} style={{padding:"5px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.accent,fontSize:11,fontWeight:600,cursor:"pointer"}}>View Dashboard →</button>
 </div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
 <div style={{padding:12,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:20,fontWeight:600,color:T.text}}>{subJobs.length}</div><div style={{fontSize:10,color:T.textMuted}}>Total Jobs</div></div>
 <div style={{padding:12,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:20,fontWeight:600,color:T.text}}>{completed}</div><div style={{fontSize:10,color:T.textMuted}}>Completed</div></div>
 <div style={{padding:12,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:20,fontWeight:600,color:T.text}}>{totalFeet>=1000?`${(totalFeet/1000).toFixed(0)}k`:totalFeet} ft</div><div style={{fontSize:10,color:T.textMuted}}>Total Footage</div></div>
 <div style={{padding:12,background:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:20,fontWeight:600,color:T.success}}>{$(totalRev)}</div><div style={{fontSize:10,color:T.textMuted}}>Revenue</div></div>
 <div style={{padding:12,background:pendingReview>0?T.warningSoft:T.bgInput,borderRadius:4,textAlign:"center"}}><div style={{fontSize:20,fontWeight:600,color:pendingReview>0?T.warning:T.textDim}}>{pendingReview+pendingRedlines}</div><div style={{fontSize:10,color:T.textMuted}}>Pending</div></div>
 </div>
 <div style={{fontSize:12,fontWeight:600,color:T.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Active Regions</div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 {s.regions.map(r=><Badge key={r} label={r} color={T.accent} bg={T.accentSoft}/>)}
 </div>
 </Card>;
 })}
 </div>;
}

// ─── MATERIALS & INVENTORY ───────────────────────────────────────────────────
function MaterialsView(){
 const{jobs,trucks,pickups,setPickups,materialMode,setMaterialMode}=useApp();
 const[tab,setTab]=useState("overview");
 const[selTruck,setSelTruck]=useState(null);
 const[showLog,setShowLog]=useState(false);
 const[editingPickup,setEditingPickup]=useState(null);
 const[logData,setLogData]=useState({truckId:"",items:{},notes:"",warehouse:"",pickedUpBy:"",date:""});
 const[showAdjust,setShowAdjust]=useState(null);
 const[adjustQty,setAdjustQty]=useState("");
 const[adjustReason,setAdjustReason]=useState("");
 const isSelf=materialMode==="self";

 const logPickup=()=>{
  if(!logData.truckId)return;
  const items=Object.entries(logData.items).filter(([,qty])=>qty>0).map(([materialId,qty])=>({materialId,qty:parseInt(qty)||0}));
  if(items.length===0)return;
  if(editingPickup){
   setPickups(prev=>prev.map(p=>p.id===editingPickup?{...p,truckId:logData.truckId,date:logData.date||p.date,warehouse:logData.warehouse||p.warehouse,pickedUpBy:logData.pickedUpBy||p.pickedUpBy,items,notes:logData.notes||""}:p));
  } else {
   const p={id:`PU-${Date.now()}`,truckId:logData.truckId,date:logData.date||new Date().toISOString().split("T")[0],warehouse:logData.warehouse||(isSelf?"Self-Purchased":"MasTec Warehouse"),pickedUpBy:logData.pickedUpBy||"Admin User",items,notes:logData.notes||""};
   setPickups(prev=>[...prev,p]);
  }
  setShowLog(false);setEditingPickup(null);setLogData({truckId:"",items:{},notes:"",warehouse:"",pickedUpBy:"",date:""});
 };

 const editPickup=(p)=>{
  const items={};p.items.forEach(i=>{items[i.materialId]=i.qty;});
  setLogData({truckId:p.truckId,items,notes:p.notes,warehouse:p.warehouse,pickedUpBy:p.pickedUpBy,date:p.date});
  setEditingPickup(p.id);setShowLog(true);
 };

 const deletePickup=(id)=>{setPickups(prev=>prev.filter(p=>p.id!==id));};

 const applyAdjustment=()=>{
  if(!showAdjust||!adjustQty)return;
  const adj=parseInt(adjustQty)||0;if(adj===0)return;
  const p={id:`ADJ-${Date.now()}`,truckId:showAdjust.truckId,date:new Date().toISOString().split("T")[0],warehouse:"Manual Adjustment",pickedUpBy:"Admin User",items:[{materialId:showAdjust.materialId,qty:adj}],notes:adjustReason||"Manual inventory adjustment"};
  setPickups(prev=>[...prev,p]);setShowAdjust(null);setAdjustQty("");setAdjustReason("");
 };

 // Compute inventory per truck: pickups - consumption from completed jobs
 const inventory=useMemo(()=>{
 const inv={};
 trucks.forEach(t=>{inv[t.id]={};MATERIALS.forEach(m=>{inv[t.id][m.id]={picked:0,used:0};});});
 pickups.forEach(p=>{
 if(!inv[p.truckId])return;
 p.items.forEach(item=>{if(inv[p.truckId][item.materialId])inv[p.truckId][item.materialId].picked+=item.qty;});
 });
 jobs.filter(j=>j.production&&j.department==="aerial"&&j.assignedTruck).forEach(j=>{
 const ti=inv[j.assignedTruck];if(!ti)return;
 (j.production.spans||[]).forEach(sp=>{
 const ft=sp.strandSpan||0;const wts=sp.workTypes||[];
 if(wts.includes("Strand")){ti["mat-strand"].used+=ft;ti["mat-lash-wire"].used+=ft;}
 if(wts.includes("Overlash"))ti["mat-lash-wire"].used+=ft;
 if(wts.includes("Fiber"))ti["mat-fiber48"].used+=ft;
 if(wts.includes("Fiber Conduit Pulling"))ti["mat-conduit"].used+=ft;
 if(sp.anchor)ti["mat-anchor"].used++;if(sp.coil)ti["mat-coil"].used++;if(sp.snowshoe)ti["mat-snowshoe"].used++;
 });
 });
 Object.values(inv).forEach(ti=>{Object.values(ti).forEach(m=>{m.onHand=Math.max(0,m.picked-m.used);});});
 return inv;
 },[jobs,trucks,pickups]);

 const totalCost=useMemo(()=>{let c=0;Object.values(inventory).forEach(ti=>{MATERIALS.forEach(m=>{c+=(ti[m.id]?.used||0)*m.unitCost;});});return c;},[inventory]);
 const totalPicked=useMemo(()=>{let c=0;Object.values(inventory).forEach(ti=>{MATERIALS.forEach(m=>{c+=(ti[m.id]?.picked||0)*m.unitCost;});});return c;},[inventory]);
 const totalPickedQty=useMemo(()=>{let c=0;pickups.forEach(p=>p.items.forEach(i=>{c+=i.qty;}));return c;},[pickups]);
 const totalUsedQty=useMemo(()=>{let c=0;Object.values(inventory).forEach(ti=>{Object.values(ti).forEach(m=>{c+=m.used;});});return c;},[inventory]);

 const lowStock=useMemo(()=>{
 const alerts=[];
 trucks.forEach(t=>{const ti=inventory[t.id];if(!ti)return;
 MATERIALS.forEach(m=>{const oh=ti[m.id]?.onHand||0;if(oh<m.restockThreshold)alerts.push({truck:t,material:m,onHand:oh,threshold:m.restockThreshold});});
 });return alerts;
 },[inventory,trucks]);

 // Truck detail view
 const selT=selTruck?trucks.find(x=>x.id===selTruck):null;
 const selTI=selTruck?inventory[selTruck]||{}:{};
 const selPickups=selTruck?pickups.filter(p=>p.truckId===selTruck).sort((a,b)=>b.date.localeCompare(a.date)):[];
 const selTJobs=selTruck?jobs.filter(j=>j.assignedTruck===selTruck&&j.production&&j.department==="aerial"):[];

 return <div>
 {selTruck?<div>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
 <Btn v="ghost" sz="sm" onClick={()=>setSelTruck(null)}>← Back</Btn>
 <div><h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{selT?.label}</h2>
 <div style={{fontSize:12,color:T.textMuted}}>Owner: {selT?.investorName||"Company"} · {selTJobs.length} completed jobs</div></div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:20}}>
 {MATERIALS.map(m=>{const d=selTI[m.id]||{picked:0,used:0,onHand:0};const low=d.onHand<m.restockThreshold;
 return <Card key={m.id} style={{padding:14,borderLeft:`3px solid ${low?T.danger:T.success}`}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase",marginBottom:6}}>{m.name}</div>
 <div style={{fontSize:22,fontWeight:600,color:low?T.danger:T.text}}>{d.onHand.toLocaleString()}<span style={{fontSize:12,fontWeight:400,color:T.textMuted}}> {m.unit}</span></div>
 <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:T.textDim}}>
 <span>{isSelf?"Purchased":"Checked out"}: {d.picked.toLocaleString()}</span><span>Installed: {d.used.toLocaleString()}</span>
 </div>
 <div style={{height:4,borderRadius:2,background:T.bgInput,marginTop:6,overflow:"hidden"}}>
 <div style={{height:"100%",borderRadius:2,background:low?T.danger:T.success,width:`${Math.min((d.onHand/Math.max(d.picked,1))*100,100)}%`}}/>
 </div>
 {isSelf&&<div style={{fontSize:10,color:T.textMuted,marginTop:4}}>Cost: {$(d.used*m.unitCost)}</div>}
 {low&&<div style={{fontSize:10,color:T.danger,fontWeight:600,marginTop:4}}>Below threshold ({m.restockThreshold.toLocaleString()})</div>}
 <button onClick={e=>{e.stopPropagation();setShowAdjust({truckId:selTruck,materialId:m.id,name:m.name});}} style={{marginTop:6,width:"100%",padding:"4px 0",borderRadius:3,border:`1px solid ${T.border}`,background:"transparent",color:T.accent,cursor:"pointer",fontSize:10,fontWeight:600}}>Adjust</button>
 </Card>;})}
 </div>
 <h3 style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:10}}>{isSelf?"Purchase":"Pickup"} History</h3>
 {selPickups.length===0&&<Card style={{padding:24,textAlign:"center"}}><div style={{color:T.textMuted,fontSize:13}}>No {isSelf?"purchases":"pickups"} logged for this truck yet.</div><Btn sz="sm" onClick={()=>{setLogData(p=>({...p,truckId:selTruck}));setShowLog(true);}} style={{marginTop:8}}>{isSelf?"+ Log Purchase":"+ Log Pickup"}</Btn></Card>}
 {selPickups.map(p=><Card key={p.id} style={{marginBottom:8,padding:14}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <div><span style={{fontSize:13,fontWeight:600,color:T.accent,fontFamily:"monospace"}}>{p.id}</span><span style={{fontSize:12,color:T.textMuted,marginLeft:8}}>{fd(p.date)}</span></div>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <div style={{fontSize:11,color:T.textMuted}}>{p.warehouse}</div>
 <button onClick={()=>editPickup(p)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:3,color:T.accent,cursor:"pointer",padding:"2px 6px",fontSize:10}}>Edit</button>
 <button onClick={()=>{if(confirm(`Delete ${p.id}?`))deletePickup(p.id);}} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:3,color:T.danger,cursor:"pointer",padding:"2px 6px",fontSize:10}}>✕</button>
 </div>
 </div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 {p.items.map((item,i)=>{const m=MATERIALS.find(x=>x.id===item.materialId);return <span key={i} style={{fontSize:11,padding:"3px 8px",borderRadius:4,background:T.bgInput,color:T.text}}>{m?.name}: <b>{item.qty.toLocaleString()}</b> {m?.unit}</span>;})}
 </div>
 <div style={{fontSize:11,color:T.textDim,marginTop:6}}>{isSelf?"Purchased":"Picked up"} by {p.pickedUpBy} · {p.notes}</div>
 </Card>)}
 </div>
 :<div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
 <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Materials & Inventory</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{isSelf?"Track material purchases, job costs, and profit margins":"Track material checkouts from client warehouse, installation accountability, and reconciliation"}</p>
 </div>
 <div style={{display:"flex",gap:8,alignItems:"center"}}>
 <Btn onClick={()=>setShowLog(true)}>{isSelf?"+ Log Purchase":"+ Log Pickup"}</Btn>
 {/* Mode toggle */}
 <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:T.bgCard,borderRadius:6,border:`1px solid ${T.border}`}}>
 <button onClick={()=>setMaterialMode("client")} style={{padding:"6px 14px",borderRadius:4,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",transition:"all 0.15s",
 background:!isSelf?T.accent:"transparent",color:!isSelf?"#fff":T.textMuted}}>Client-Provided</button>
 <button onClick={()=>setMaterialMode("self")} style={{padding:"6px 14px",borderRadius:4,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",transition:"all 0.15s",
 background:isSelf?T.accent:"transparent",color:isSelf?"#fff":T.textMuted}}>Self-Purchased</button>
 </div>
 </div>
 </div>

 {/* Summary */}
 <div style={{display:"grid",gridTemplateColumns:`repeat(${isSelf?4:3},1fr)`,gap:12,marginBottom:20}}>
 {isSelf?<>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Materials Purchased</div><div style={{fontSize:26,fontWeight:600,color:T.text,marginTop:4}}>{$(totalPicked)}</div><div style={{fontSize:11,color:T.textDim}}>{pickups.length} purchases</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Materials Consumed</div><div style={{fontSize:26,fontWeight:600,color:T.warning,marginTop:4}}>{$(totalCost)}</div><div style={{fontSize:11,color:T.textDim}}>installed on jobs</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>On Hand Value</div><div style={{fontSize:26,fontWeight:600,color:T.success,marginTop:4}}>{$(totalPicked-totalCost)}</div><div style={{fontSize:11,color:T.textDim}}>remaining on trucks</div></Card>
 </>:<>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Checked Out</div><div style={{fontSize:26,fontWeight:600,color:T.text,marginTop:4}}>{totalPickedQty.toLocaleString()}</div><div style={{fontSize:11,color:T.textDim}}>{pickups.length} pickups from MasTec</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Installed</div><div style={{fontSize:26,fontWeight:600,color:T.success,marginTop:4}}>{totalUsedQty.toLocaleString()}</div><div style={{fontSize:11,color:T.textDim}}>units across all jobs</div></Card>
 </>}
 <Card style={{padding:16,borderLeft:`3px solid ${lowStock.length>0?T.danger:T.success}`}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Low Stock Alerts</div><div style={{fontSize:26,fontWeight:600,color:lowStock.length>0?T.danger:T.success,marginTop:4}}>{lowStock.length}</div><div style={{fontSize:11,color:T.textDim}}>trucks need restock</div></Card>
 </div>

 {/* Client-provided mode info banner */}
 {!isSelf&&<div style={{padding:"10px 16px",background:T.bgInput,borderRadius:6,marginBottom:16,display:"flex",alignItems:"center",gap:10,border:`1px solid ${T.border}`}}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
 <span style={{fontSize:12,color:T.textMuted}}>Materials provided by <b style={{color:T.text}}>MasTec</b>. Tracking checkouts and installation for reconciliation. <span style={{color:T.accent,cursor:"pointer"}} onClick={()=>setMaterialMode("self")}>Switch to cost tracking →</span></span>
 </div>}

 {/* Tabs */}
 <div style={{display:"flex",gap:4,marginBottom:16}}>
 {[{k:"overview",l:"Truck Inventory"},{k:"pickups",l:isSelf?"Purchase Log":"Checkout Log"},{k:"consumption",l:isSelf?"Job Costs":"Reconciliation"},{k:"alerts",l:"Restock Alerts",n:lowStock.length}].map(t=>
 <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",borderRadius:4,border:`1px solid ${tab===t.k?T.accent:T.border}`,background:tab===t.k?T.accentSoft:"transparent",color:tab===t.k?T.accent:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
 {t.l}{t.n!=null?` (${t.n})`:""}
 </button>)}
 </div>

 {tab==="overview"&&<div>
 {trucks.map(t=>{
 const ti=inventory[t.id]||{};
 const hasLow=MATERIALS.some(m=>(ti[m.id]?.onHand||0)<m.restockThreshold);
 return <Card key={t.id} hover onClick={()=>setSelTruck(t.id)} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
 <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`}}>
 <div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{t.id}</div><div style={{fontSize:11,color:T.textMuted}}>{t.label.split("·")[1]?.trim()}</div></div>
 {hasLow?<Badge label="Needs Restock" color={T.danger} bg={T.dangerSoft}/>:<Badge label="Stocked" color={T.success} bg={T.successSoft}/>}
 </div>
 <div style={{display:"flex",padding:"8px 0"}}>
 {MATERIALS.filter(m=>m.category==="hardware"||m.id==="mat-fiber48"||m.id==="mat-strand").map(m=>{
 const d=ti[m.id]||{onHand:0};const low=d.onHand<m.restockThreshold;
 return <div key={m.id} style={{flex:1,textAlign:"center",padding:"4px 8px",borderRight:`1px solid ${T.border}`}}>
 <div style={{fontSize:9,color:T.textDim,fontWeight:600,textTransform:"uppercase"}}>{m.name.replace(" Assembly","").replace(" Spool (48ct)","").replace("Expansion ","")}</div>
 <div style={{fontSize:14,fontWeight:600,color:low?T.danger:T.text}}>{d.onHand>=1000?`${(d.onHand/1000).toFixed(1)}k`:d.onHand}</div>
 </div>;})}
 </div>
 </Card>;})}
 </div>}

 {tab==="pickups"&&<Card style={{padding:0,overflow:"hidden"}}>
 {pickups.sort((a,b)=>b.date.localeCompare(a.date)).map((p,i)=>{
 const t=trucks.find(x=>x.id===p.truckId);
 const totalVal=p.items.reduce((s,item)=>{const m=MATERIALS.find(x=>x.id===item.materialId);return s+(m?item.qty*m.unitCost:0);},0);
 const totalQty=p.items.reduce((s,item)=>s+item.qty,0);
 return <div key={p.id} style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <div style={{width:8,height:8,borderRadius:"50%",background:p.id.startsWith("ADJ")?T.warning:T.success}}/>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{p.id} · {t?.id||p.truckId}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{p.warehouse} · {p.pickedUpBy}</div>
 <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
 {p.items.slice(0,4).map((item,j)=>{const m=MATERIALS.find(x=>x.id===item.materialId);return <span key={j} style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:T.bgInput,color:T.textMuted}}>{m?.name.split(" ")[0]}: {item.qty>=1000?`${(item.qty/1000).toFixed(1)}k`:item.qty}</span>;})}
 {p.items.length>4&&<span style={{fontSize:10,color:T.textDim}}>+{p.items.length-4} more</span>}
 </div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{textAlign:"right"}}>
 {isSelf?<div style={{fontSize:13,fontWeight:600,color:T.text}}>{$(totalVal)}</div>
 :<div style={{fontSize:13,fontWeight:600,color:T.text}}>{totalQty.toLocaleString()} units</div>}
 <div style={{fontSize:11,color:T.textMuted}}>{fd(p.date)}</div>
 </div>
 <div style={{display:"flex",gap:4}}>
 <button onClick={()=>editPickup(p)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:3,color:T.accent,cursor:"pointer",padding:"3px 8px",fontSize:10,fontWeight:600}}>Edit</button>
 <button onClick={()=>{if(confirm(`Delete ${p.id}?`))deletePickup(p.id);}} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:3,color:T.danger,cursor:"pointer",padding:"3px 8px",fontSize:10,fontWeight:600}}>✕</button>
 </div>
 </div>
 </div>;})}
 </Card>}

 {tab==="consumption"&&<Card style={{padding:0,overflow:"hidden"}}>
 <div style={{display:"grid",gridTemplateColumns:`2fr repeat(${MATERIALS.length},1fr)${isSelf?" 1fr":""}`,fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>
 <div style={{padding:"10px 14px"}}>Job</div>
 {MATERIALS.map(m=><div key={m.id} style={{padding:"10px 6px",textAlign:"center"}}>{m.name.split(" ")[0]}</div>)}
 {isSelf&&<div style={{padding:"10px 6px",textAlign:"center"}}>Cost</div>}
 </div>
 {jobs.filter(j=>j.production&&j.department==="aerial").slice(0,20).map(j=>{
 const usage={};MATERIALS.forEach(m=>{usage[m.id]=0;});
 (j.production.spans||[]).forEach(sp=>{
 const ft=sp.strandSpan||0;const wts=sp.workTypes||[];
 if(wts.includes("Strand"))usage["mat-strand"]+=ft;
 if(wts.includes("Fiber"))usage["mat-fiber48"]+=ft;
 if(wts.includes("Fiber Conduit Pulling"))usage["mat-conduit"]+=ft;
 if(wts.includes("Overlash")||wts.includes("Strand"))usage["mat-lash-wire"]+=ft;
 if(sp.anchor)usage["mat-anchor"]++;if(sp.coil)usage["mat-coil"]++;if(sp.snowshoe)usage["mat-snowshoe"]++;
 });
 const cost=MATERIALS.reduce((s,m)=>s+usage[m.id]*m.unitCost,0);
 return <div key={j.id} style={{display:"grid",gridTemplateColumns:`2fr repeat(${MATERIALS.length},1fr)${isSelf?" 1fr":""}`,borderBottom:`1px solid ${T.border}`,fontSize:12}}>
 <div style={{padding:"8px 14px"}}><span style={{fontWeight:600,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</span>{!isSelf&&<span style={{color:T.textDim,marginLeft:6,fontSize:10}}>{j.assignedTruck}</span>}</div>
 {MATERIALS.map(m=><div key={m.id} style={{padding:"8px 6px",textAlign:"center",color:usage[m.id]>0?T.text:T.textDim}}>{usage[m.id]>0?(usage[m.id]>=1000?`${(usage[m.id]/1000).toFixed(1)}k`:usage[m.id]):"—"}</div>)}
 {isSelf&&<div style={{padding:"8px 6px",textAlign:"center",fontWeight:600,color:T.warning}}>{$(cost)}</div>}
 </div>;})}
 </Card>}

 {tab==="alerts"&&<div>
 {lowStock.length===0?<Card><div style={{padding:32,textAlign:"center",color:T.success}}><div style={{fontSize:24,marginBottom:8}}>✓</div><div style={{fontSize:14,fontWeight:600}}>All Trucks Stocked</div><div style={{fontSize:12,color:T.textMuted}}>No materials below restock threshold</div></div></Card>
 :lowStock.map((a,i)=><Card key={i} style={{marginBottom:8,padding:14,borderLeft:`3px solid ${T.danger}`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{a.material.name}</div>
 <div style={{fontSize:12,color:T.textMuted}}>{a.truck.id} · {a.truck.label.split("·")[1]?.trim()}</div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:16,fontWeight:600,color:T.danger}}>{a.onHand.toLocaleString()} <span style={{fontSize:11,fontWeight:400}}>{a.material.unit}</span></div>
 <div style={{fontSize:10,color:T.textDim}}>Threshold: {a.threshold.toLocaleString()}</div>
 </div>
 <button onClick={()=>{setLogData({truckId:a.truck.id,items:{[a.material.id]:a.threshold-a.onHand},notes:`Restock ${a.material.name}`,warehouse:"",pickedUpBy:"",date:""});setShowLog(true);}} style={{padding:"6px 12px",borderRadius:4,border:`1px solid ${T.accent}`,background:T.accentSoft,color:T.accent,cursor:"pointer",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>Restock</button>
 </div>
 </div>
 </Card>)}
 </div>}
 </div>}

 {/* Adjust inventory modal */}
 <Modal open={!!showAdjust} onClose={()=>setShowAdjust(null)} title={`Adjust Inventory — ${showAdjust?.name||""}`} width={380}>
 {showAdjust&&<div>
 <p style={{fontSize:12,color:T.textMuted,marginBottom:12}}>Truck: <b>{showAdjust.truckId}</b> · Manually add or remove units.</p>
 <Inp label="Quantity (+/- units)" type="number" value={adjustQty} onChange={setAdjustQty} ph="e.g. 500 to add, -100 to remove"/>
 <Inp label="Reason" value={adjustReason} onChange={setAdjustReason} ph="e.g. Damaged, returned to warehouse, count correction"/>
 <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}><Btn v="ghost" onClick={()=>setShowAdjust(null)}>Cancel</Btn><Btn onClick={applyAdjustment} disabled={!adjustQty}>Apply</Btn></div>
 </div>}
 </Modal>

 <Modal open={showLog} onClose={()=>{setShowLog(false);setEditingPickup(null);}} title={editingPickup?`Edit ${editingPickup}`:(isSelf?"Log Material Purchase":"Log Material Pickup")} width={520}>
 <div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
 <Inp label="Truck" value={logData.truckId} onChange={v=>setLogData(p=>({...p,truckId:v}))} options={trucks.map(t=>({value:t.id,label:t.label}))}/>
 <Inp label="Date" type="date" value={logData.date||new Date().toISOString().split("T")[0]} onChange={v=>setLogData(p=>({...p,date:v}))}/>
 <Inp label={isSelf?"Supplier / Vendor":"Warehouse"} value={logData.warehouse||""} onChange={v=>setLogData(p=>({...p,warehouse:v}))} ph={isSelf?"e.g. Graybar, Anixter":"e.g. MasTec Decatur Yard"}/>
 <Inp label="Picked Up By" value={logData.pickedUpBy||""} onChange={v=>setLogData(p=>({...p,pickedUpBy:v}))} ph="e.g. Matheus"/>
 </div>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.3,marginBottom:8,marginTop:4}}>Materials</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
 {MATERIALS.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:8}}>
 <label style={{fontSize:12,color:T.text,flex:1}}>{m.name}</label>
 <input type="number" value={logData.items[m.id]||""} onChange={e=>setLogData(p=>({...p,items:{...p.items,[m.id]:e.target.value}}))} placeholder="0" style={{width:70,padding:"6px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,textAlign:"right",boxSizing:"border-box"}}/>
 <span style={{fontSize:10,color:T.textDim,width:24}}>{m.unit==="ft"?"ft":"ea"}</span>
 </div>)}
 </div>
 <Inp label={isSelf?"PO # / Notes":"Notes"} value={logData.notes} onChange={v=>setLogData(p=>({...p,notes:v}))} ph={isSelf?"PO #12345, Weekly restock":"Weekly restock, ticket #, etc."}/>
 <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}><Btn v="ghost" onClick={()=>setShowLog(false)}>Cancel</Btn><Btn onClick={logPickup} disabled={!logData.truckId}>{editingPickup?"Save Changes":"Log"}</Btn></div>
 </div>
 </Modal>
 </div>;
}

// ─── CREW SCHEDULING & DISPATCH ──────────────────────────────────────────────
function ScheduleView(){
 const{jobs,setJobs,trucks,drills,rateCards}=useApp();
 const[weekOffset,setWeekOffset]=useState(0);
 const[dragJob,setDragJob]=useState(null);
 const[filterRegion,setFilterRegion]=useState("all");
 const[filterDept,setFilterDept]=useState("all");

 const now=new Date();
 const weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-weekStart.getDay()+1+(weekOffset*7));
 const weekDays=Array.from({length:5},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d;});
 const weekLabel=`${fd(weekDays[0])} — ${fd(weekDays[4])}`;

 const linemen=USERS.filter(u=>u.role==="lineman");
 const foremen=USERS.filter(u=>u.role==="foreman");
 const allCrew=[...linemen,...foremen];

 // Compute productivity stats per crew member
 const crewStats=useMemo(()=>{
 const stats={};
 allCrew.forEach(c=>{
 const myJobs=jobs.filter(j=>j.assignedLineman===c.id);
 const completed=myJobs.filter(j=>j.production);
 const totalFeet=completed.reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 const avgFeet=completed.length>0?Math.round(totalFeet/completed.length):0;
 const assigned=myJobs.filter(j=>j.status==="Assigned").length;
 const truck=myJobs.find(j=>j.assignedTruck)?.assignedTruck||null;
 stats[c.id]={completed:completed.length,totalFeet,avgFeet,assigned,truck,role:c.role};
 });
 return stats;
 },[jobs]);

 // Unassigned jobs
 const unassigned=jobs.filter(j=>j.status==="Unassigned"&&!j.production)
 .filter(j=>filterRegion==="all"||j.region===filterRegion)
 .filter(j=>filterDept==="all"||j.department===filterDept)
 .sort((a,b)=>(a.scheduledDate||"").localeCompare(b.scheduledDate||""));

 // Jobs per crew per day
 const getCrewDayJobs=(crewId,day)=>{
 const ds=day.toISOString().split("T")[0];
 return jobs.filter(j=>j.assignedLineman===crewId&&j.scheduledDate===ds&&j.status==="Assigned"&&!j.production);
 };

 // Assign job to crew
 const assignJob=(jobId,crewId,dayDate)=>{
 const crew=allCrew.find(c=>c.id===crewId);
 const isUG=crew?.role==="foreman";
 // Find the truck this crew usually uses (from their existing assignments)
 const usualTruck=crewStats[crewId]?.truck||null;
 const truckId=!isUG?(usualTruck||trucks[0]?.id):null;
 const drillId=isUG?(drills[0]?.id||null):null;
 setJobs(prev=>prev.map(j=>{
 if(j.id!==jobId)return j;
 if(j.status!=="Unassigned"||j.production)return j;// guard: only assign unassigned jobs without production
 return{...j,status:"Assigned",assignedLineman:crewId,
 assignedTruck:truckId,truckInvestor:trucks.find(t=>t.id===truckId)?.owner||null,
 assignedDrill:drillId,drillInvestor:drills.find(d=>d.id===drillId)?.owner||null,
 scheduledDate:dayDate};
 }));
 setDragJob(null);
 };

 // Unassign job — only if it has no production data
 const unassignJob=(jobId)=>{
 setJobs(prev=>prev.map(j=>{
 if(j.id!==jobId)return j;
 if(j.production)return j;// guard: never unassign a job that has production
 return{...j,status:"Unassigned",assignedLineman:null,assignedTruck:null,truckInvestor:null,assignedDrill:null,drillInvestor:null};
 }));
 };

 const regions=[...new Set(jobs.map(j=>j.region))];

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
 <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Crew Scheduling & Dispatch</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>Assign crews to jobs by dragging from the job pool or clicking to assign</p>
 </div>
 <div style={{display:"flex",gap:8,alignItems:"center"}}>
 <button onClick={()=>setWeekOffset(w=>w-1)} style={{width:32,height:32,borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`,color:T.text,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
 <div style={{textAlign:"center",minWidth:180}}>
 <div style={{fontSize:14,fontWeight:600,color:T.text}}>{weekOffset===0?"This Week":weekOffset===1?"Next Week":weekOffset===-1?"Last Week":`Week ${weekOffset>0?"+":""}${weekOffset}`}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{weekLabel}</div>
 </div>
 <button onClick={()=>setWeekOffset(w=>w+1)} style={{width:32,height:32,borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`,color:T.text,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>
 {weekOffset!==0&&<button onClick={()=>setWeekOffset(0)} style={{padding:"6px 12px",borderRadius:6,background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,fontSize:11,fontWeight:600,cursor:"pointer"}}>Today</button>}
 </div>
 </div>

 <div style={{display:"flex",gap:16}}>
 {/* Left: Job Pool */}
 <div style={{width:260,flexShrink:0}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <h3 style={{fontSize:13,fontWeight:600,color:T.textMuted,margin:0,textTransform:"uppercase",letterSpacing:0.5}}>Unassigned ({unassigned.length})</h3>
 </div>
 <div style={{display:"flex",gap:4,marginBottom:8}}>
 <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} style={{flex:1,padding:"5px 8px",borderRadius:6,fontSize:11,background:T.bgInput,color:T.text,border:`1px solid ${T.border}`}}>
 <option value="all">All Regions</option>
 {regions.map(r=><option key={r} value={r}>{r}</option>)}
 </select>
 <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{flex:1,padding:"5px 8px",borderRadius:6,fontSize:11,background:T.bgInput,color:T.text,border:`1px solid ${T.border}`}}>
 <option value="all">All Types</option>
 <option value="aerial">Aerial</option>
 <option value="underground">Underground</option>
 </select>
 </div>
 <div style={{maxHeight:"calc(100vh - 220px)",overflowY:"auto",paddingRight:4}}>
 {unassigned.length===0?<div style={{padding:20,textAlign:"center",color:T.textDim,fontSize:12}}>No unassigned jobs</div>
 :unassigned.map(j=><div key={j.id}
 draggable onDragStart={()=>setDragJob(j.id)}
 onClick={()=>setDragJob(dragJob===j.id?null:j.id)}
 style={{padding:"10px 12px",marginBottom:6,background:dragJob===j.id?T.accentSoft:T.bgCard,borderRadius:6,border:`1px solid ${dragJob===j.id?T.accent:T.border}`,cursor:"grab",transition:"all 0.12s",
 boxShadow:dragJob===j.id?`0 0 0 2px ${T.accent}44`:"none"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
 <span style={{fontSize:11,fontWeight:700,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</span>
 <Badge label={j.department==="underground"?"UG":"Aerial"} color={j.department==="underground"?T.orange:T.cyan} bg={j.department==="underground"?T.orangeSoft:T.cyanSoft}/>
 </div>
 <div style={{fontSize:12,fontWeight:600,color:T.text}}>{j.location}</div>
 <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>{j.customer} · {j.region}</div>
 <div style={{fontSize:10,color:T.textDim,marginTop:2}}>~{j.estimatedFootage} ft</div>
 </div>)}
 </div>
 </div>

 {/* Right: Schedule Grid */}
 <div style={{flex:1,overflowX:"auto"}}>
 <div style={{display:"grid",gridTemplateColumns:`160px repeat(5,1fr)`,gap:0,minWidth:700}}>
 {/* Header row */}
 <div style={{padding:"10px 12px",fontWeight:600,color:T.textMuted,fontSize:11,textTransform:"uppercase",borderBottom:`2px solid ${T.border}`}}>Crew</div>
 {weekDays.map((d,i)=>{const isToday=d.toDateString()===now.toDateString();
 return <div key={i} style={{padding:"10px 8px",textAlign:"center",borderBottom:`2px solid ${isToday?T.accent:T.border}`,borderLeft:`1px solid ${T.border}`}}>
 <div style={{fontSize:11,fontWeight:600,color:isToday?T.accent:T.textMuted}}>{["Mon","Tue","Wed","Thu","Fri"][i]}</div>
 <div style={{fontSize:10,color:isToday?T.accent:T.textDim}}>{d.getMonth()+1}/{d.getDate()}</div>
 </div>;})}

 {/* Crew rows */}
 {allCrew.map(c=>{
 const st=crewStats[c.id]||{};
 const isUG=c.role==="foreman";
 return <React.Fragment key={c.id}>
 {/* Crew info cell */}
 <div style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
 <div style={{width:30,height:30,borderRadius:4,background:isUG?T.orangeSoft:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:isUG?T.orange:T.accent}}>
 {c.name.split(" ").map(n=>n[0]).join("")}
 </div>
 <div>
 <div style={{fontSize:12,fontWeight:600,color:T.text}}>{c.name}</div>
 <div style={{fontSize:9,color:T.textDim}}>
 {isUG?"Foreman":"Lineman"} · {st.truck||"No truck"}
 </div>
 <div style={{fontSize:9,color:T.success}}>{st.avgFeet>0?`Avg ${st.avgFeet} ft/job`:""}</div>
 </div>
 </div>
 {/* Day cells */}
 {weekDays.map((d,di)=>{
 const ds=d.toDateString()===now.toDateString();
 const dayJobs=getCrewDayJobs(c.id,d);
 const dateStr=d.toISOString().split("T")[0];
 return <div key={di}
 onDragOver={e=>{e.preventDefault();e.currentTarget.style.background=T.accentSoft;}}
 onDragLeave={e=>{e.currentTarget.style.background="transparent";}}
 onDrop={e=>{e.preventDefault();e.currentTarget.style.background="transparent";if(dragJob){const j=jobs.find(jj=>jj.id===dragJob);if(j&&((!isUG&&j.department==="aerial")||(isUG&&j.department==="underground")))assignJob(dragJob,c.id,dateStr);}}}
 onClick={()=>{if(dragJob){const j=jobs.find(jj=>jj.id===dragJob);if(j&&((!isUG&&j.department==="aerial")||(isUG&&j.department==="underground")))assignJob(dragJob,c.id,dateStr);}}}
 style={{padding:4,borderBottom:`1px solid ${T.border}`,borderLeft:`1px solid ${T.border}`,minHeight:60,background:ds?`${T.accent}06`:"transparent",cursor:dragJob?"crosshair":"default",transition:"background 0.1s"}}>
 {dayJobs.map(j=><div key={j.id} style={{padding:"6px 8px",marginBottom:3,borderRadius:6,fontSize:10,
 background:j.department==="underground"?T.orangeSoft:T.cyanSoft,
 border:`1px solid ${j.department==="underground"?T.orange+"33":T.cyan+"33"}`,position:"relative"}}>
 <div style={{fontWeight:700,color:j.department==="underground"?T.orange:T.cyan,fontFamily:"monospace"}}>{j.feederId.slice(-6)}</div>
 <div style={{color:T.textMuted,marginTop:1}}>{j.location?.split(",")[0]}</div>
 <div style={{color:T.textDim}}>~{j.estimatedFootage}ft</div>
 <button onClick={e=>{e.stopPropagation();unassignJob(j.id);}} style={{position:"absolute",top:3,right:3,background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:10,padding:2,lineHeight:1}} title="Unassign">✕</button>
 </div>)}
 {dayJobs.length===0&&dragJob&&<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:T.textDim,fontSize:10,opacity:0.5}}>Drop here</div>}
 </div>;})}
 </React.Fragment>;})}
 </div>

 {/* Crew capacity summary */}
 <div style={{marginTop:20}}>
 <h3 style={{fontSize:13,fontWeight:600,color:T.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Crew Workload This Week</h3>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:10}}>
 {allCrew.map(c=>{
 const st=crewStats[c.id]||{};
 const weekJobs=weekDays.reduce((s,d)=>s+getCrewDayJobs(c.id,d).length,0);
 const weekFt=weekDays.reduce((s,d)=>s+getCrewDayJobs(c.id,d).reduce((ss,j)=>ss+(j.estimatedFootage||0),0),0);
 const load=weekJobs/5;// jobs per day avg
 const isUG=c.role==="foreman";
 return <Card key={c.id} style={{padding:12}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <div style={{width:24,height:24,borderRadius:6,background:isUG?T.orangeSoft:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:isUG?T.orange:T.accent}}>
 {c.name.split(" ").map(n=>n[0]).join("")}
 </div>
 <span style={{fontSize:12,fontWeight:600,color:T.text}}>{c.name}</span>
 </div>
 <Badge label={weekJobs===0?"Open":load>=1.5?"Heavy":load>=0.8?"Balanced":"Light"}
 color={weekJobs===0?T.textDim:load>=1.5?T.danger:load>=0.8?T.success:T.warning}
 bg={(weekJobs===0?T.textDim:load>=1.5?T.danger:load>=0.8?T.success:T.warning)+"18"}/>
 </div>
 <div style={{display:"flex",gap:8}}>
 <div style={{flex:1,textAlign:"center",padding:"6px 0",background:T.bgInput,borderRadius:6}}>
 <div style={{fontSize:16,fontWeight:600,color:T.text}}>{weekJobs}</div><div style={{fontSize:9,color:T.textMuted}}>Jobs</div>
 </div>
 <div style={{flex:1,textAlign:"center",padding:"6px 0",background:T.bgInput,borderRadius:6}}>
 <div style={{fontSize:16,fontWeight:600,color:T.text}}>{weekFt>=1000?`${(weekFt/1000).toFixed(1)}k`:weekFt}</div><div style={{fontSize:9,color:T.textMuted}}>Est. ft</div>
 </div>
 <div style={{flex:1,textAlign:"center",padding:"6px 0",background:T.bgInput,borderRadius:6}}>
 <div style={{fontSize:16,fontWeight:600,color:T.success}}>{st.avgFeet||0}</div><div style={{fontSize:9,color:T.textMuted}}>Avg ft/job</div>
 </div>
 </div>
 </Card>;})}
 </div>
 </div>
 </div>
 </div>
 </div>;
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────
// ─── MY SCHEDULE (Lineman/Foreman view) ─────────────────────────────────────
function MyScheduleView(){
 const{jobs,currentUser,trucks,drills}=useApp();
 const[weekOff,setWeekOff]=useState(0);
 const now=new Date();
 const weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-weekStart.getDay()+1+weekOff*7);weekStart.setHours(0,0,0,0);
 const days=Array.from({length:5},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d;});
 const weekLabel=`${days[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${days[4].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
 const todayStr=now.toISOString().split("T")[0];

 // Get jobs assigned to me this week
 const myJobs=jobs.filter(j=>{
 const isMe=j.assignedLineman===currentUser.id;
 if(!isMe)return false;
 if(!j.scheduledDate)return false;
 const sd=new Date(j.scheduledDate);
 return sd>=days[0]&&sd<=new Date(days[4].getTime()+86400000);
 });

 const myTruck=trucks.find(t=>t.assignedTo===currentUser.id);
 const myDrill=currentUser.role==="foreman"?drills.find(d=>d.assignedTo===currentUser.id):null;

 // Weekly stats
 const weekFeet=myJobs.filter(j=>j.production).reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 const weekCompleted=myJobs.filter(j=>j.production).length;
 const weekPending=myJobs.filter(j=>!j.production).length;

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
 <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>My Schedule</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{myJobs.length} jobs this week · {weekPending} upcoming · {weekCompleted} completed</p>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <button onClick={()=>setWeekOff(w=>w-1)} style={{width:32,height:32,borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontSize:14}}>←</button>
 <button onClick={()=>setWeekOff(0)} style={{padding:"6px 14px",borderRadius:4,border:`1px solid ${weekOff===0?T.accent:T.border}`,background:weekOff===0?T.accentSoft:"transparent",color:weekOff===0?T.accent:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer"}}>Today</button>
 <button onClick={()=>setWeekOff(w=>w+1)} style={{width:32,height:32,borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontSize:14}}>→</button>
 <span style={{fontSize:13,fontWeight:600,color:T.text,marginLeft:4}}>{weekLabel}</span>
 </div>
 </div>

 {/* Equipment info */}
 <div style={{display:"flex",gap:10,marginBottom:16}}>
 {myTruck&&<Card style={{padding:"10px 14px",flex:1,display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:32,height:32,borderRadius:4,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.8"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
 </div>
 <div><div style={{fontSize:12,fontWeight:600,color:T.text}}>{myTruck.name}</div><div style={{fontSize:10,color:T.textMuted}}>{myTruck.year} · Owner: {myTruck.investor}</div></div>
 </Card>}
 {myDrill&&<Card style={{padding:"10px 14px",flex:1,display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:32,height:32,borderRadius:4,background:T.orangeSoft,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.orange} strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83"/></svg>
 </div>
 <div><div style={{fontSize:12,fontWeight:600,color:T.text}}>{myDrill.name}</div><div style={{fontSize:10,color:T.textMuted}}>{myDrill.year} · Owner: {myDrill.investor}</div></div>
 </Card>}
 <Card style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:32,height:32,borderRadius:4,background:T.successSoft,display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="1.8"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/></svg>
 </div>
 <div><div style={{fontSize:16,fontWeight:700,color:T.success}}>{weekFeet>=1000?`${(weekFeet/1000).toFixed(1)}k`:weekFeet} ft</div><div style={{fontSize:10,color:T.textMuted}}>This week</div></div>
 </Card>
 </div>

 {/* Day-by-day schedule */}
 <div style={{display:"flex",flexDirection:"column",gap:8}}>
 {days.map((day,di)=>{
 const ds=day.toISOString().split("T")[0];
 const isToday=ds===todayStr;
 const dayJobs=myJobs.filter(j=>j.scheduledDate===ds);
 const dayName=day.toLocaleDateString("en-US",{weekday:"long"});
 const dayDate=day.toLocaleDateString("en-US",{month:"short",day:"numeric"});
 const isPast=day<new Date(todayStr);

 return <Card key={di} style={{padding:0,overflow:"hidden",border:isToday?`2px solid ${T.accent}`:`1px solid ${T.border}`,opacity:isPast&&!isToday?0.7:1}}>
 <div style={{padding:"10px 16px",background:isToday?T.accentSoft:T.bgInput,display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 {isToday&&<div style={{width:8,height:8,borderRadius:"50%",background:T.accent}}/>}
 <span style={{fontSize:14,fontWeight:isToday?700:600,color:isToday?T.accent:T.text}}>{dayName}</span>
 <span style={{fontSize:12,color:T.textMuted}}>{dayDate}</span>
 </div>
 <span style={{fontSize:11,color:T.textMuted}}>{dayJobs.length} job{dayJobs.length!==1?"s":""}</span>
 </div>
 {dayJobs.length===0?
 <div style={{padding:"20px 16px",textAlign:"center",color:T.textDim,fontSize:12}}>{isPast?"No jobs":"No jobs scheduled"}</div>
 :<div>
 {dayJobs.map(j=>{
 const done=!!j.production;
 const sc=STATUS_CFG[j.status]||{c:T.textMuted,bg:"transparent"};
 return <div key={j.id} style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12}}>
 <div style={{width:36,height:36,borderRadius:4,background:done?T.successSoft:j.department==="underground"?T.orangeSoft:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
 {done?"✓":j.department==="underground"?"⬇":"↑"}
 </div>
 <div style={{flex:1}}>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <span style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:"monospace"}}>{j.feederId}</span>
 <Badge label={j.department==="underground"?"UG":"Aerial"} color={j.department==="underground"?T.orange:T.cyan} bg={j.department==="underground"?T.orangeSoft:T.cyanSoft}/>
 <Badge label={j.status} color={sc.c} bg={sc.bg}/>
 </div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{j.location} · {j.customer} · {j.region}</div>
 </div>
 <div style={{textAlign:"right"}}>
 {done?<>
 <div style={{fontSize:15,fontWeight:700,color:T.success}}>{j.production.totalFeet?.toLocaleString()} ft</div>
 <div style={{fontSize:10,color:T.textMuted}}>{j.production.spans?.length||0} spans</div>
 </>:<>
 <div style={{fontSize:13,fontWeight:600,color:T.textMuted}}>{j.estimatedFootage?.toLocaleString()||"—"} ft</div>
 <div style={{fontSize:10,color:T.textDim}}>estimated</div>
 </>}
 </div>
 </div>;})}
 </div>}
 </Card>;})}
 </div>
 </div>;
}

// ─── MAP CUTTER — AI FEEDER EXTRACTOR ──────────────────────────────────────
function MapCutterView(){
 const{jobs,setJobs}=useApp();
 const[mcStatus,setMcStatus]=useState("idle"); // idle | loading | processing | done | error
 const[mcPages,setMcPages]=useState([]);
 const[mcResults,setMcResults]=useState([]);
 const[mcProgress,setMcProgress]=useState({current:0,total:0});
 const[mcError,setMcError]=useState(null);
 const[mcSelFeeder,setMcSelFeeder]=useState(null);
 const[mcView,setMcView]=useState("feeders");
 const[mcFileName,setMcFileName]=useState("");
 const[createdJobs,setCreatedJobs]=useState({});
 const fileRef=useRef(null);

 const ensurePdfJs=()=>new Promise((resolve,reject)=>{
 if(window.pdfjsLib){resolve(window.pdfjsLib);return;}
 const existing=document.querySelector('script[src*="pdf.min.js"]');
 if(existing){existing.addEventListener("load",()=>{if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(window.pdfjsLib);}else reject(new Error("PDF.js failed to initialize"));});return;}
 const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
 s.onload=()=>{if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(window.pdfjsLib);}else reject(new Error("PDF.js failed to initialize"));};
 s.onerror=()=>reject(new Error("Failed to load PDF.js library"));
 document.head.appendChild(s);
 });

 const MCPROMPT=`You are a fiber optic construction drawing analyzer. Extract ALL feeder/cable segment identifiers (BSPD IDs) visible on each construction drawing page, along with navigation references.

What to look for:
1. BSPD Feeder IDs: Labels on colored route lines (orange, blue, yellow, cyan). Patterns like "Armored 144F BSPD001", "Armored 48F BSPD001.01a". The key identifier is the BSPD portion.
2. Construction Drawing Number: In bottom-right area, "CONSTRUCTION DRAWING# X".
3. "TO PRINT X" References: At edges of drawing indicating route continuity.
4. Splice Closures, MRE markers, Risers, Caution notes, Span lengths.

CRITICAL: Extract EXACT BSPD ID preserving dots and letter suffixes. A single page can have MULTIPLE feeders.

Respond ONLY with valid JSON (no markdown, no backticks):
{"construction_drawing_number":<number or null>,"project_name":"<string or null>","feeders":[{"bspd_id":"<e.g. BSPD001.01a>","cable_description":"<e.g. Armored 48F>","full_label":"<exact text>"}],"to_print_references":[<drawing numbers>],"splice_closures":["<labels>"],"risers":["<descriptions>"],"mre_markers":["<descriptions>"],"caution_notes":["<warnings>"],"span_lengths_total_ft":<number or null>,"notes":"<observations>"}`;

 const loadPdf=async(file)=>{
 setMcStatus("loading");setMcError(null);setMcFileName(file.name);
 try{
 const buf=await file.arrayBuffer();
 const lib=await ensurePdfJs();
 const pdf=await lib.getDocument({data:new Uint8Array(buf)}).promise;
 const imgs=[];
 for(let i=1;i<=pdf.numPages;i++){
 const pg=await pdf.getPage(i);
 const vp=pg.getViewport({scale:2.0});
 const cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;
 await pg.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
 const du=cv.toDataURL("image/jpeg",0.85);
 imgs.push({pageNum:i,base64:du.split(",")[1],dataUrl:du});
 }
 setMcPages(imgs);return imgs;
 }catch(e){throw new Error(`PDF load failed: ${e.message}`);}
 };

 const analyzePages=async(imgs)=>{
 setMcStatus("processing");setMcProgress({current:0,total:imgs.length});
 const all=[];
 for(let i=0;i<imgs.length;i++){
 setMcProgress({current:i+1,total:imgs.length});
 try{
 const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:MCPROMPT,
 messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgs[i].base64}},{type:"text",text:`Analyze construction drawing page (PDF page ${i+1}). Extract all BSPD feeder IDs, construction drawing number, TO PRINT references. Return ONLY valid JSON.`}]}]})});
 const d=await res.json();
 const txt=d.content.map(x=>x.type==="text"?x.text:"").filter(Boolean).join("\n");
 const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());
 all.push({...parsed,_pdfPage:i+1,_success:true});
 }catch(e){all.push({_pdfPage:i+1,_success:false,_error:e.message,construction_drawing_number:null,feeders:[],to_print_references:[]});}
 }
 setMcResults(all);setMcStatus("done");
 };

 const handleFile=async(file)=>{
 if(!file||!file.name.toLowerCase().endsWith(".pdf")){setMcError("Please upload a PDF file.");return;}
 try{const imgs=await loadPdf(file);await analyzePages(imgs);}
 catch(e){setMcError(e.message);setMcStatus("error");}
 };

 // Build feeder map
 const feederMap={};
 mcResults.forEach(r=>{if(!r.feeders)return;r.feeders.forEach(f=>{
 const id=f.bspd_id;if(!id)return;
 if(!feederMap[id])feederMap[id]={bspd_id:id,cable_description:f.cable_description,full_label:f.full_label,drawings:[],pdfPages:[],splices:[],risers:[],totalFt:0};
 const dwg=r.construction_drawing_number;
 if(dwg&&!feederMap[id].drawings.includes(dwg))feederMap[id].drawings.push(dwg);
 if(!feederMap[id].pdfPages.includes(r._pdfPage))feederMap[id].pdfPages.push(r._pdfPage);
 if(r.splice_closures)r.splice_closures.forEach(s=>{if(!feederMap[id].splices.includes(s))feederMap[id].splices.push(s);});
 if(r.risers)r.risers.forEach(s=>{if(!feederMap[id].risers.includes(s))feederMap[id].risers.push(s);});
 if(r.span_lengths_total_ft)feederMap[id].totalFt+=r.span_lengths_total_ft;
 });});
 const feeders=Object.values(feederMap).sort((a,b)=>a.bspd_id.localeCompare(b.bspd_id));
 const selData=mcSelFeeder?feederMap[mcSelFeeder]:null;

 const createJobFromFeeder=(f)=>{
 const newId=String(jobs.length+1+Object.keys(createdJobs).length).padStart(4,"0");
 const newJob={id:newId,department:"aerial",client:"MasTec",customer:"Brightspeed",region:"Alabama",
 location:f.bspd_id,olt:"OLT-"+f.bspd_id.split(".")[0].replace("BSPD",""),feederId:f.bspd_id,
 workType:"Strand",estimatedFootage:f.totalFt||0,poleCount:f.drawings.length*4,
 scheduledDate:new Date().toISOString().split("T")[0],supervisorNotes:`Auto-created from Map Cutter. ${f.cable_description||""} — ${f.drawings.length} drawings (${f.pdfPages.join(", ")}).`,
 assignedLineman:null,assignedTruck:null,truckInvestor:null,assignedDrill:null,drillInvestor:null,
 status:"Unassigned",redlineStatus:null,srNumber:null,production:null,confirmedTotals:null,redlines:[],
 mapPages:f.pdfPages,mapDrawings:f.drawings,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 setJobs(prev=>[...prev,newJob]);
 setCreatedJobs(prev=>({...prev,[f.bspd_id]:newId}));
 };

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
 <div>
 <h2 style={{fontSize:20,fontWeight:700,color:T.text,margin:0}}>Map Cutter</h2>
 <p style={{fontSize:13,color:T.textMuted,marginTop:2}}>AI-powered feeder extraction from construction drawing PDFs</p>
 </div>
 {mcStatus==="done"&&<Btn v="ghost" onClick={()=>{setMcStatus("idle");setMcPages([]);setMcResults([]);setMcSelFeeder(null);setCreatedJobs({});}}>↻ New PDF</Btn>}
 </div>

 {/* Upload Zone */}
 {mcStatus==="idle"&&<div onDrop={e=>{e.preventDefault();const f=e.dataTransfer?.files?.[0];if(f)handleFile(f);}} onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current?.click()}
 style={{border:`2px dashed ${T.border}`,borderRadius:14,padding:"56px 32px",textAlign:"center",cursor:"pointer",background:T.bgInput,transition:"all 0.2s"}}
 onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.background=T.accent+"08";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.bgInput;}}>
 <div style={{width:56,height:56,borderRadius:14,background:`linear-gradient(135deg,${T.accent},${T.accent}cc)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
 </div>
 <p style={{fontSize:17,fontWeight:600,marginBottom:6,color:T.text}}>Drop construction drawing PDF here</p>
 <p style={{fontSize:13,color:T.textMuted}}>MasTec / Byers fiber optic project PDFs with BSPD feeder IDs</p>
 <input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>
 </div>}

 {/* Processing */}
 {(mcStatus==="loading"||mcStatus==="processing")&&<Card style={{padding:"48px 32px",textAlign:"center"}}>
 <div style={{width:40,height:40,border:`3px solid ${T.border}`,borderTopColor:T.accent,borderRadius:"50%",margin:"0 auto 16px",animation:"spin 0.8s linear infinite"}}/>
 {mcStatus==="loading"&&<p style={{fontSize:15,fontWeight:600,color:T.text}}>Rendering PDF pages...</p>}
 {mcStatus==="processing"&&<>
 <p style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:10}}>Analyzing drawings with AI</p>
 <div style={{maxWidth:360,margin:"0 auto",height:5,background:T.bgInput,borderRadius:3,overflow:"hidden"}}>
 <div style={{width:`${(mcProgress.current/mcProgress.total)*100}%`,height:"100%",background:`linear-gradient(90deg,${T.accent},${T.accent}cc)`,borderRadius:3,transition:"width 0.3s"}}/>
 </div>
 <p style={{fontSize:12,color:T.textMuted,marginTop:8}}>Page {mcProgress.current} of {mcProgress.total} · {mcFileName}</p>
 </>}
 </Card>}

 {/* Error */}
 {mcStatus==="error"&&<Card style={{padding:32,textAlign:"center",borderColor:T.danger}}>
 <p style={{color:T.danger,fontWeight:600,marginBottom:8}}>Error</p>
 <p style={{color:T.textMuted,marginBottom:16}}>{mcError}</p>
 <Btn onClick={()=>{setMcStatus("idle");setMcError(null);}}>Try Again</Btn>
 </Card>}

 {/* Results */}
 {mcStatus==="done"&&<>
 {/* Stats */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
 {[{l:"Pages Analyzed",v:mcResults.length,c:T.accent},{l:"Feeders Found",v:feeders.length,c:T.warning},{l:"Drawings Mapped",v:mcResults.filter(r=>r.construction_drawing_number).length,c:T.success},{l:"Success Rate",v:`${Math.round((mcResults.filter(r=>r._success).length/mcResults.length)*100)}%`,c:T.cyan}].map((s,i)=>
 <Card key={i} style={{padding:"12px 16px"}}><div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>{s.l}</div><div style={{fontSize:24,fontWeight:700,color:s.c,fontFamily:"monospace"}}>{s.v}</div></Card>)}
 </div>

 {/* Tabs */}
 <div style={{display:"flex",gap:4,marginBottom:16,background:T.bgInput,padding:3,borderRadius:4,width:"fit-content"}}>
 {[{id:"feeders",l:"Feeders"},{id:"drawings",l:"By Drawing"},{id:"raw",l:"Raw JSON"}].map(t=>
 <button key={t.id} onClick={()=>setMcView(t.id)} style={{padding:"6px 16px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:mcView===t.id?T.accent:"transparent",color:mcView===t.id?"#fff":T.textMuted,transition:"all 0.15s"}}>{t.l}</button>)}
 </div>

 {/* Feeders View */}
 {mcView==="feeders"&&<div style={{display:"grid",gridTemplateColumns:selData?"1fr 1fr":"1fr",gap:14}}>
 <div style={{display:"flex",flexDirection:"column",gap:8}}>
 {feeders.map(f=>{const isCreated=!!createdJobs[f.bspd_id];return <Card key={f.bspd_id} onClick={()=>setMcSelFeeder(mcSelFeeder===f.bspd_id?null:f.bspd_id)} className="card-hover"
 style={{padding:"14px 18px",cursor:"pointer",borderColor:mcSelFeeder===f.bspd_id?T.accent:undefined,background:mcSelFeeder===f.bspd_id?T.accent+"08":undefined}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
 <span style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:T.accent}}>{f.bspd_id}</span>
 <div style={{display:"flex",gap:6,alignItems:"center"}}>
 {isCreated&&<Badge label="Job Created" color={T.success} bg={T.successSoft}/>}
 <span style={{fontSize:11,color:T.textMuted,background:T.bgInput,padding:"2px 8px",borderRadius:6}}>{f.drawings.length} dwg{f.drawings.length!==1?"s":""}</span>
 </div>
 </div>
 <p style={{fontSize:12,color:T.textMuted}}>{f.cable_description||"Unknown cable"}{f.totalFt>0?` · ~${f.totalFt.toLocaleString()} ft`:""}</p>
 <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
 {f.drawings.sort((a,b)=>a-b).map(d=><span key={d} style={{fontFamily:"monospace",fontSize:10,fontWeight:600,color:T.cyan,background:T.cyan+"15",padding:"2px 6px",borderRadius:4}}>DWG #{d}</span>)}
 </div>
 </Card>;})}
 {feeders.length===0&&<Card style={{padding:32,textAlign:"center"}}><p style={{color:T.textDim}}>No feeder IDs detected.</p></Card>}
 </div>

 {/* Selected Feeder Detail */}
 {selData&&<Card style={{padding:18,position:"sticky",top:24,alignSelf:"start",maxHeight:"80vh",overflowY:"auto"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
 <div>
 <h3 style={{fontFamily:"monospace",fontSize:17,fontWeight:700,color:T.accent,margin:0}}>{selData.bspd_id}</h3>
 <p style={{fontSize:12,color:T.textMuted,marginTop:2}}>{selData.full_label||selData.cable_description}</p>
 </div>
 {!createdJobs[selData.bspd_id]?<Btn sz="sm" onClick={()=>createJobFromFeeder(selData)}>+ Create Job</Btn>
 :<Badge label={`Job #${createdJobs[selData.bspd_id]}`} color={T.success} bg={T.successSoft}/>}
 </div>

 {/* Stats */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
 <div style={{padding:10,background:T.bgInput,borderRadius:6,textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:T.cyan}}>{selData.drawings.length}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>DRAWINGS</div></div>
 <div style={{padding:10,background:T.bgInput,borderRadius:6,textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:T.warning}}>{selData.pdfPages.length}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>PDF PAGES</div></div>
 <div style={{padding:10,background:T.bgInput,borderRadius:6,textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:T.success}}>{selData.totalFt>0?`~${selData.totalFt}`:"-"}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>EST. FT</div></div>
 </div>

 {/* Route chain */}
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Route Through Drawings</div>
 {selData.drawings.sort((a,b)=>a-b).map((dwg,idx)=>{
 const pr=mcResults.find(r=>r.construction_drawing_number===dwg);
 return <div key={dwg}>
 <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:T.bgInput,borderRadius:6}}>
 <div style={{width:28,height:28,borderRadius:6,background:T.cyan+"18",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontSize:12,fontWeight:700,color:T.cyan,flexShrink:0}}>{dwg}</div>
 <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Drawing #{dwg}</div>
 {pr&&<div style={{fontSize:10,color:T.textDim,marginTop:1}}>{pr.to_print_references?.length?`→ Print ${pr.to_print_references.join(", ")}`:"Terminal"}</div>}
 </div></div>
 {idx<selData.drawings.length-1&&<div style={{width:2,height:12,background:T.accent,marginLeft:23}}/>}
 </div>;})}

 {/* Splices & Risers */}
 {selData.splices.length>0&&<div style={{marginTop:12}}><div style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",marginBottom:4}}>Splice Closures</div>
 {selData.splices.map((s,i)=><div key={i} style={{fontSize:11,fontFamily:"monospace",color:T.purple,marginBottom:2}}>{s}</div>)}</div>}
 {selData.risers.length>0&&<div style={{marginTop:10}}><div style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",marginBottom:4}}>Risers</div>
 {selData.risers.map((s,i)=><div key={i} style={{fontSize:11,fontFamily:"monospace",color:T.warning,marginBottom:2}}>{s}</div>)}</div>}

 {/* Page thumbnails */}
 {mcPages.length>0&&<div style={{marginTop:14}}>
 <div style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",marginBottom:6}}>Page Previews</div>
 {selData.pdfPages.map(pn=><img key={pn} src={mcPages[pn-1]?.dataUrl} alt={`Page ${pn}`} style={{width:"100%",borderRadius:6,border:`1px solid ${T.border}`,marginBottom:6}}/>)}
 </div>}
 </Card>}
 </div>}

 {/* Drawings View */}
 {mcView==="drawings"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
 {mcResults.sort((a,b)=>(a.construction_drawing_number||999)-(b.construction_drawing_number||999)).map((r,i)=>
 <Card key={i} style={{padding:"14px 18px"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <span style={{fontFamily:"monospace",fontWeight:700,fontSize:14,color:T.text}}>{r.construction_drawing_number?`Drawing #${r.construction_drawing_number}`:`PDF Page ${r._pdfPage}`}</span>
 {!r._success&&<Badge label="Parse Error" color={T.danger} bg={T.dangerSoft}/>}
 </div>
 {r.feeders?.length>0&&<div style={{marginBottom:6}}><span style={{fontSize:10,color:T.textDim,marginRight:6}}>FEEDERS:</span>
 {r.feeders.map((f,fi)=><span key={fi} style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:T.accent,background:T.accent+"15",padding:"2px 6px",borderRadius:4,marginRight:4}}>{f.bspd_id}</span>)}</div>}
 {r.to_print_references?.length>0&&<div style={{marginBottom:6}}><span style={{fontSize:10,color:T.textDim,marginRight:6}}>CONNECTS TO:</span>
 {r.to_print_references.map((p,pi)=><span key={pi} style={{fontFamily:"monospace",fontSize:11,color:T.cyan,marginRight:6}}>Print {p}</span>)}</div>}
 {r.risers?.length>0&&<div style={{marginBottom:4}}><span style={{fontSize:10,color:T.textDim,marginRight:6}}>RISERS:</span><span style={{fontSize:11,color:T.warning}}>{r.risers.join(" | ")}</span></div>}
 {r.caution_notes?.length>0&&<div><span style={{fontSize:10,color:T.danger,marginRight:6}}>⚠ CAUTION:</span><span style={{fontSize:11,color:T.danger}}>{r.caution_notes.join(" | ")}</span></div>}
 </Card>)}
 </div>}

 {/* Raw JSON View */}
 {mcView==="raw"&&<Card style={{padding:18}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <span style={{fontSize:12,fontWeight:600,color:T.textMuted}}>Full Extraction JSON</span>
 <Btn v="ghost" sz="sm" onClick={()=>{const b=new Blob([JSON.stringify(mcResults,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="feeder-extraction.json";a.click();URL.revokeObjectURL(u);}}>Download JSON</Btn>
 </div>
 <pre style={{fontFamily:"monospace",fontSize:10,color:T.textMuted,background:T.bgInput,borderRadius:6,padding:14,overflow:"auto",maxHeight:500,whiteSpace:"pre-wrap"}}>{JSON.stringify(mcResults,null,2)}</pre>
 </Card>}
 </>}
 </div>;
}

// ─── SPLICING MODULE ─────────────────────────────────────────────────────────
// Billing codes for Brightspeed splicing work (MasTec codes)
const SPLICE_BILLING_CODES=[
 {code:"BSPDSPLTPA",label:"Place & Splice Terminal — Aerial",short:"Tap Aerial",unit:"ea"},
 {code:"BSPDSPLTPH",label:"Place & Splice Terminal — Hand-hole",short:"Tap HH",unit:"ea"},
 {code:"BSPDSPL",label:"Splice Setup / Teardown",short:"Setup",unit:"ea"},
 {code:"BSPDTSTD",label:"Test DTAP",short:"Test DTAP",unit:"ea"},
 {code:"BSPDTSTE",label:"Test Terminal (Light Levels)",short:"Test TML",unit:"ea"},
 {code:"BSPDFIBSPL",label:"Single Fiber Splice",short:"Fiber Spl",unit:"ea"},
 {code:"BSPDRIBSPL",label:"Ribbon Splice",short:"Ribbon Spl",unit:"ea"},
];
const SPLICE_PHOTO_TYPES=[
 {key:"case_tray",label:"Case Tray",desc:"Splice tray showing fiber routing",required:true},
 {key:"case_tray_detail",label:"Case Tray Detail",desc:"Close-up of tray with fiber markings",required:false},
 {key:"case_in_out",label:"Case In/Out",desc:"Cables entering and exiting the closure",required:true},
 {key:"case_cables",label:"Case Cables",desc:"Cable management and labeling",required:true},
 {key:"case_finished",label:"Case Finished",desc:"Sealed closure ready to hang",required:true},
 {key:"hung_case",label:"Hung Case",desc:"Installed on strand/pole with GPS stamp",required:true},
 {key:"light_levels",label:"Light Levels",desc:"Optical power meter reading",required:true},
 {key:"other",label:"Other",desc:"Additional documentation photos",required:false},
];
const SPLICE_PT_STATUS={
 not_started:{c:"#555",bg:"rgba(85,85,85,0.12)",l:"Not Started"},
 in_progress:{c:"#FACC15",bg:"rgba(250,204,21,0.10)",l:"In Progress"},
 photos_needed:{c:"#C084FC",bg:"rgba(192,132,252,0.10)",l:"Photos Needed"},
 ready_for_billing:{c:"#60A5FA",bg:"rgba(96,165,250,0.10)",l:"Ready for Billing"},
 codes_assigned:{c:"#4ADE80",bg:"rgba(74,222,128,0.10)",l:"Codes Assigned"},
 billed:{c:"#16A34A",bg:"rgba(22,163,74,0.10)",l:"Billed"},
};
function genSplicingProjects(){
 const DAY=86400000;const now=Date.now();
 const techs=[{id:"st1",name:"Misael"},{id:"st2",name:"Henrique"},{id:"st3",name:"Carlos"}];
 // ── Project 1: ADVLTNXA EAST (based on real data) ──
 const p1Points=[];
 // BSPD closures
 [{id:"BSPD001",codes:{BSPDSPL:3,BSPDFIBSPL:33}},{id:"BSPD001.01",codes:{BSPDSPL:1,BSPDFIBSPL:1}},{id:"BSPD001.01a",codes:{BSPDSPLTPA:1}},{id:"BSPD001.02a",codes:{BSPDSPL:1,BSPDFIBSPL:6}},{id:"BSPD001.02",codes:{BSPDSPLTPA:1}}].forEach((sp,i)=>{
  const status=i<3?"codes_assigned":i<4?"ready_for_billing":"in_progress";
  const photos=i<3?SPLICE_PHOTO_TYPES.filter(p=>p.required).map(p=>({type:p.key,fileName:`${sp.id}_${p.key}.jpg`,uploadedAt:new Date(now-(10-i)*DAY).toISOString(),uploadedBy:techs[i%3].id,techName:techs[i%3].name})):i<4?SPLICE_PHOTO_TYPES.filter(p=>p.required).slice(0,4).map(p=>({type:p.key,fileName:`${sp.id}_${p.key}.jpg`,uploadedAt:new Date(now-(8-i)*DAY).toISOString(),uploadedBy:techs[i%3].id,techName:techs[i%3].name})):[];
  p1Points.push({id:sp.id,type:"bspd",status,tech:techs[i%3],date:new Date(now-(12-i)*DAY).toISOString().split("T")[0],codes:sp.codes,srNumber:status==="codes_assigned"?`SR${1070000+i*31}`:null,photos,notes:i===0?"Main distribution splice — 33 single fiber splices":"",fusionCount:(sp.codes.BSPDFIBSPL||0),ribbonCount:(sp.codes.BSPDRIBSPL||0)});
 });
 // TML terminals (1.1 through 8.2, matching the Excel data)
 for(let branch=1;branch<=8;branch++){
  const subCount=branch===3?3:2;
  for(let sub=1;sub<=subCount;sub++){
   const id=`TML.001.${branch}.${sub}`;
   const idx=(branch-1)*2+(sub-1);
   const hasTap=!(branch===1&&sub===1)&&!(branch===4&&sub===1)&&!(branch===4&&sub===2)&&!(branch===7&&sub===1);
   const codes={};
   if(hasTap)codes.BSPDSPLTPA=1;
   if(!(branch===1&&sub===1)&&!(branch===7&&sub===1))codes.BSPDSPL=1;
   codes.BSPDTSTE=1;
   const fibCount=sub===1?2:1;
   codes.BSPDFIBSPL=fibCount;
   const status=idx<12?"codes_assigned":idx<14?"ready_for_billing":idx<16?"in_progress":"not_started";
   const photos=status==="codes_assigned"||status==="billed"?SPLICE_PHOTO_TYPES.filter(p=>p.required).map(p=>({type:p.key,fileName:`${id}_${p.key}.jpg`,uploadedAt:new Date(now-(14-idx)*DAY).toISOString(),uploadedBy:techs[idx%3].id,techName:techs[idx%3].name})):status==="ready_for_billing"?SPLICE_PHOTO_TYPES.filter(p=>p.required).slice(0,5).map(p=>({type:p.key,fileName:`${id}_${p.key}.jpg`,uploadedAt:new Date(now-(10-idx%5)*DAY).toISOString(),uploadedBy:techs[idx%3].id,techName:techs[idx%3].name})):[];
   p1Points.push({id,type:"tml",status,tech:techs[idx%3],date:status!=="not_started"?new Date(now-(16-idx)*DAY).toISOString().split("T")[0]:null,codes,srNumber:status==="codes_assigned"?`SR${1075000+idx*17}`:null,photos,notes:"",fusionCount:fibCount,ribbonCount:0});
  }
 }
 const proj1={id:"spl-001",wireCenter:"ADVLTNXA EAST",location:"Adamsville, TN",client:"MasTec",customer:"Brightspeed",map:"MAP-ADVLTNXA-EAST",status:"active",createdAt:new Date(now-30*DAY).toISOString(),splicePoints:p1Points,techs};

 // ── Project 2: FLVLALXA (Falkville) — smaller, earlier stage ──
 const p2Points=[];
 [{id:"BSPD002",type:"bspd"},{id:"BSPD002.01",type:"bspd"},{id:"TML.002.1.1",type:"tml"},{id:"TML.002.1.2",type:"tml"},{id:"TML.002.2.1",type:"tml"},{id:"TML.002.2.2",type:"tml"}].forEach((sp,i)=>{
  const status=i<2?"in_progress":i<4?"not_started":"not_started";
  const codes=sp.type==="bspd"?{BSPDSPL:1,BSPDFIBSPL:i===0?12:4}:{BSPDSPLTPA:1,BSPDSPL:1,BSPDTSTE:1,BSPDFIBSPL:i%2===0?2:1};
  const photos=status==="in_progress"?SPLICE_PHOTO_TYPES.filter(p=>p.required).slice(0,3).map(p=>({type:p.key,fileName:`${sp.id}_${p.key}.jpg`,uploadedAt:new Date(now-5*DAY).toISOString(),uploadedBy:techs[1].id,techName:techs[1].name})):[];
  p2Points.push({id:sp.id,type:sp.type,status,tech:status!=="not_started"?techs[1]:null,date:status!=="not_started"?new Date(now-5*DAY).toISOString().split("T")[0]:null,codes,srNumber:null,photos,notes:"",fusionCount:codes.BSPDFIBSPL||0,ribbonCount:0});
 });
 const proj2={id:"spl-002",wireCenter:"FLVLALXA",location:"Falkville, AL",client:"MasTec",customer:"Brightspeed",map:"MAP-FLVLALXA",status:"active",createdAt:new Date(now-10*DAY).toISOString(),splicePoints:p2Points,techs};
 return[proj1,proj2];
}

class SplicingErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={hasError:false,error:null};}
 static getDerivedStateFromError(error){return{hasError:true,error};}
 render(){if(this.state.hasError){return <div style={{padding:40,fontFamily:"monospace"}}><h2 style={{color:"#F87171"}}>Splicing Module Error</h2><pre style={{whiteSpace:"pre-wrap",fontSize:12,color:"#888",background:"#111",padding:16,borderRadius:8}}>{this.state.error?.toString()}{"\n"}{this.state.error?.stack}</pre><button onClick={()=>this.setState({hasError:false,error:null})} style={{marginTop:12,padding:"8px 16px",background:"#222",color:"#fff",border:"1px solid #444",borderRadius:4,cursor:"pointer"}}>Retry</button></div>;}return this.props.children;}
}
function SplicingView(){return <SplicingErrorBoundary><SplicingViewInner/></SplicingErrorBoundary>;}
function SplicingViewInner(){
 const{currentUser}=useApp();
 const[projects,setProjects]=useState(genSplicingProjects);
 const[selProject,setSelProject]=useState(null);
 const[selPoint,setSelPoint]=useState(null);
 const[tab,setTab]=useState("overview");
 const[pointFilter,setPointFilter]=useState("all");
 const[pointSearch,setPointSearch]=useState("");
 const[photoUpload,setPhotoUpload]=useState(null);// splice point id being uploaded to
 const[newPhotoType,setNewPhotoType]=useState("case_tray");
 const[newPhotoNote,setNewPhotoNote]=useState("");
 const[addPointOpen,setAddPointOpen]=useState(false);
 const[newPoint,setNewPoint]=useState({id:"",type:"tml"});
 const[addProjectOpen,setAddProjectOpen]=useState(false);
 const[newProject,setNewProject]=useState({wireCenter:"",location:"",client:"MasTec",customer:"Brightspeed"});
 const[debriefExporting,setDebriefExporting]=useState(false);

 const proj=selProject?projects.find(p=>p.id===selProject):null;
 const point=selPoint&&proj?proj.splicePoints.find(p=>p.id===selPoint):null;

 const updProject=(projId,updater)=>setProjects(prev=>prev.map(p=>p.id===projId?{...p,...(typeof updater==="function"?updater(p):updater)}:p));
 const updPoint=(projId,pointId,updater)=>updProject(projId,p=>({splicePoints:p.splicePoints.map(sp=>sp.id===pointId?{...sp,...(typeof updater==="function"?updater(sp):updater)}:sp)}));

 // ── PROJECT LIST VIEW ──
 if(!selProject){
 return <div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
   <div><h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Splicing Projects</h1><p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{projects.length} wire centers</p></div>
   <Btn onClick={()=>setAddProjectOpen(true)}>+ New Project</Btn>
  </div>

  {addProjectOpen&&<Card style={{marginBottom:16,borderColor:T.accent+"44"}}>
   <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:12}}>New Splicing Project</div>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
    <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>WIRE CENTER</div><input value={newProject.wireCenter} onChange={e=>setNewProject({...newProject,wireCenter:e.target.value})} placeholder="e.g. ADVLTNXA EAST" style={{width:"100%",padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/></div>
    <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>LOCATION</div><input value={newProject.location} onChange={e=>setNewProject({...newProject,location:e.target.value})} placeholder="e.g. Adamsville, TN" style={{width:"100%",padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/></div>
    <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>CLIENT</div><select value={newProject.client} onChange={e=>setNewProject({...newProject,client:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>{CLIENTS.map(c=><option key={c}>{c}</option>)}</select></div>
    <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>CUSTOMER</div><select value={newProject.customer} onChange={e=>setNewProject({...newProject,customer:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>{CUSTOMERS.map(c=><option key={c}>{c}</option>)}</select></div>
   </div>
   <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
    <Btn v="ghost" sz="sm" onClick={()=>setAddProjectOpen(false)}>Cancel</Btn>
    <Btn sz="sm" onClick={()=>{if(!newProject.wireCenter.trim())return;setProjects(prev=>[...prev,{id:"spl-"+Date.now(),wireCenter:newProject.wireCenter.trim(),location:newProject.location.trim(),client:newProject.client,customer:newProject.customer,map:`MAP-${newProject.wireCenter.trim().replace(/\s+/g,"-")}`,status:"active",createdAt:new Date().toISOString(),splicePoints:[],techs:[]}]);setAddProjectOpen(false);setNewProject({wireCenter:"",location:"",client:"MasTec",customer:"Brightspeed"});}}>Create Project</Btn>
   </div>
  </Card>}

  {projects.map(p=>{
   const total=p.splicePoints.length;
   const completed=p.splicePoints.filter(sp=>sp.status==="codes_assigned"||sp.status==="billed").length;
   const inProgress=p.splicePoints.filter(sp=>sp.status==="in_progress"||sp.status==="photos_needed"||sp.status==="ready_for_billing").length;
   const notStarted=p.splicePoints.filter(sp=>sp.status==="not_started").length;
   const pctComplete=total>0?Math.round((completed/total)*100):0;
   const totalPhotos=p.splicePoints.reduce((s,sp)=>s+(sp.photos?.length||0),0);
   const totalFiber=p.splicePoints.reduce((s,sp)=>s+(sp.fusionCount||0),0);
   const bspdCount=p.splicePoints.filter(sp=>sp.type==="bspd").length;
   const tmlCount=p.splicePoints.filter(sp=>sp.type==="tml").length;
   return <Card key={p.id} hover onClick={()=>{setSelProject(p.id);setTab("overview");}} style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
     <div style={{flex:1}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
       <span style={{fontSize:16,fontWeight:700,color:T.text}}>{p.wireCenter}</span>
       <Badge label={p.status==="active"?"Active":"Complete"} color={p.status==="active"?T.success:T.textMuted} bg={p.status==="active"?T.successSoft:"rgba(85,85,85,0.1)"}/>
      </div>
      <div style={{fontSize:12,color:T.textMuted}}>{p.location} · {p.customer} · {p.client}</div>
      <div style={{display:"flex",gap:16,marginTop:10,fontSize:12}}>
       <span style={{color:T.textDim}}><b style={{color:T.text}}>{bspdCount}</b> BSPDs</span>
       <span style={{color:T.textDim}}><b style={{color:T.text}}>{tmlCount}</b> Terminals</span>
       <span style={{color:T.textDim}}><b style={{color:T.text}}>{totalPhotos}</b> photos</span>
       <span style={{color:T.textDim}}><b style={{color:T.text}}>{totalFiber}</b> fiber splices</span>
      </div>
     </div>
     <div style={{textAlign:"right"}}>
      <div style={{fontSize:28,fontWeight:700,color:pctComplete===100?T.success:T.accent}}>{pctComplete}%</div>
      <div style={{fontSize:10,color:T.textMuted}}>{completed}/{total} complete</div>
     </div>
    </div>
    {/* Progress bar */}
    <div style={{marginTop:12,height:6,borderRadius:3,background:T.bgInput,overflow:"hidden",display:"flex"}}>
     {completed>0&&<div style={{width:`${(completed/total)*100}%`,height:"100%",background:T.success,transition:"width 0.3s"}}/>}
     {inProgress>0&&<div style={{width:`${(inProgress/total)*100}%`,height:"100%",background:T.warning,transition:"width 0.3s"}}/>}
    </div>
    <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:T.textDim}}>
     <span>● <span style={{color:T.success}}>{completed} complete</span></span>
     <span>● <span style={{color:T.warning}}>{inProgress} in progress</span></span>
     <span>● {notStarted} not started</span>
    </div>
   </Card>;
  })}
 </div>;
 }

 // ── SINGLE SPLICE POINT DETAIL ──
 if(selPoint&&point&&proj){
  const reqPhotos=SPLICE_PHOTO_TYPES.filter(p=>p.required);
  const uploadedTypes=new Set((point.photos||[]).map(p=>p.type));
  const missingPhotos=reqPhotos.filter(p=>!uploadedTypes.has(p.key));
  const stCfg=SPLICE_PT_STATUS[point.status]||SPLICE_PT_STATUS.not_started;
  return <div>
   <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
    <Btn v="ghost" sz="sm" onClick={()=>setSelPoint(null)}>← Back to {proj.wireCenter}</Btn>
    <div style={{flex:1}}>
     <div style={{display:"flex",alignItems:"center",gap:10}}>
      <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text,fontFamily:"monospace"}}>{point.id}</h1>
      <span style={{padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:600,color:stCfg.c,background:stCfg.bg}}>{stCfg.l}</span>
      <span style={{fontSize:11,color:T.textDim,textTransform:"uppercase",fontWeight:600}}>{point.type==="bspd"?"Distribution Splice":"Terminal"}</span>
     </div>
     <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{proj.wireCenter} · {proj.location} · Tech: {point.tech?.name||"Unassigned"}{point.date?` · ${point.date}`:""}</div>
    </div>
    {point.srNumber&&<div style={{background:T.successSoft,padding:"6px 14px",borderRadius:4}}><span style={{fontSize:11,color:T.textMuted}}>SR# </span><span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:T.success}}>{point.srNumber}</span></div>}
   </div>

   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    {/* LEFT: Photos */}
    <div>
     <Card style={{padding:0,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
       <div><div style={{fontSize:13,fontWeight:700,color:T.text}}>Photo Evidence</div><div style={{fontSize:11,color:T.textMuted}}>{(point.photos||[]).length} uploaded · {missingPhotos.length} missing</div></div>
       <Btn sz="sm" onClick={()=>setPhotoUpload(photoUpload===point.id?null:point.id)}>{photoUpload===point.id?"Cancel":"+ Add Photo"}</Btn>
      </div>

      {photoUpload===point.id&&<div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.accentSoft}}>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>Photo Type</div><select value={newPhotoType} onChange={e=>setNewPhotoType(e.target.value)} style={{width:"100%",padding:"7px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11}}>
         {SPLICE_PHOTO_TYPES.map(pt=>{const has=uploadedTypes.has(pt.key);return <option key={pt.key} value={pt.key}>{pt.label}{has?" ✓":pt.required?" (required)":""}</option>;})}
        </select></div>
        <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>Note</div><input value={newPhotoNote} onChange={e=>setNewPhotoNote(e.target.value)} placeholder="Optional note" style={{width:"100%",padding:"7px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11,boxSizing:"border-box"}}/></div>
       </div>
       <div style={{marginTop:8,padding:"16px 12px",border:`2px dashed ${T.border}`,borderRadius:6,textAlign:"center",cursor:"pointer"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;}}>
        <div style={{fontSize:11,color:T.textMuted}}>Drop photo or click to browse</div>
       </div>
       <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
        <Btn sz="sm" onClick={()=>{
         const photo={type:newPhotoType,fileName:`${point.id}_${newPhotoType}_${Date.now()}.jpg`,uploadedAt:new Date().toISOString(),uploadedBy:currentUser.id,techName:currentUser.name,note:newPhotoNote};
         updPoint(proj.id,point.id,sp=>({photos:[...(sp.photos||[]),photo],status:sp.status==="not_started"?"in_progress":sp.status}));
         setNewPhotoType("case_tray");setNewPhotoNote("");setPhotoUpload(null);
        }}>Upload</Btn>
       </div>
      </div>}

      {/* Photo checklist */}
      <div style={{padding:"8px 0"}}>
       {SPLICE_PHOTO_TYPES.map(pt=>{
        const uploaded=(point.photos||[]).filter(p=>p.type===pt.key);
        const has=uploaded.length>0;
        return <div key={pt.key} style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}08`,display:"flex",alignItems:"center",gap:10}}>
         <div style={{width:24,height:24,borderRadius:4,border:`1.5px solid ${has?T.success:pt.required?T.warning:T.textDim}`,background:has?T.successSoft:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:has?T.success:pt.required?T.warning:T.textDim,flexShrink:0}}>{has?"✓":"—"}</div>
         <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:600,color:has?T.text:T.textDim}}>{pt.label}{!pt.required&&<span style={{fontSize:10,color:T.textDim}}> (optional)</span>}</div>
          {has&&<div style={{fontSize:10,color:T.textMuted}}>{uploaded[0].techName} · {new Date(uploaded[0].uploadedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}{uploaded.length>1?` (+${uploaded.length-1} more)`:""}</div>}
         </div>
         {has&&<button onClick={()=>{updPoint(proj.id,point.id,sp=>({photos:(sp.photos||[]).filter(p=>!(p.type===pt.key&&p.fileName===uploaded[0].fileName))}));}} style={{background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:11,padding:4}}>✕</button>}
        </div>;
       })}
      </div>
     </Card>
    </div>

    {/* RIGHT: Billing Codes & Status */}
    <div>
     <Card>
      <h3 style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Billing Codes</h3>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
       {SPLICE_BILLING_CODES.map(bc=>{
        const qty=point.codes?.[bc.code]||0;
        return <div key={bc.code} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:6,background:qty>0?T.accentSoft:"transparent",border:`1px solid ${qty>0?T.accent+"20":T.border}`}}>
         <div style={{width:32,textAlign:"center",fontSize:14,fontWeight:700,color:qty>0?T.accent:T.textDim,fontFamily:"monospace"}}>{qty}</div>
         <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:qty>0?T.text:T.textDim}}>{bc.short}</div><div style={{fontSize:10,color:T.textDim,fontFamily:"monospace"}}>{bc.code}</div></div>
         <div style={{display:"flex",gap:2}}>
          <button onClick={()=>updPoint(proj.id,point.id,sp=>({codes:{...sp.codes,[bc.code]:Math.max(0,(sp.codes?.[bc.code]||0)-1)}}))} style={{width:22,height:22,borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.textMuted,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
          <button onClick={()=>updPoint(proj.id,point.id,sp=>({codes:{...sp.codes,[bc.code]:(sp.codes?.[bc.code]||0)+1}}))} style={{width:22,height:22,borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.textMuted,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
         </div>
        </div>;
       })}
      </div>
     </Card>

     <Card style={{marginTop:12}}>
      <h3 style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>Status & Actions</h3>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
       {/* Status progression buttons */}
       {point.status==="not_started"&&<Btn onClick={()=>updPoint(proj.id,point.id,{status:"in_progress"})}>Start Splice Work</Btn>}
       {point.status==="in_progress"&&missingPhotos.length===0&&<Btn onClick={()=>updPoint(proj.id,point.id,{status:"ready_for_billing"})}>Mark Photos Complete → Ready for Billing</Btn>}
       {point.status==="in_progress"&&missingPhotos.length>0&&<div style={{padding:10,borderRadius:6,background:T.warningSoft,border:`1px solid ${T.warning}30`,fontSize:11,color:T.warning}}>{missingPhotos.length} required photo{missingPhotos.length!==1?"s":""} still needed: {missingPhotos.map(p=>p.label).join(", ")}</div>}
       {point.status==="ready_for_billing"&&<div><div style={{fontSize:11,color:T.textMuted,marginBottom:6}}>Enter SR# from MasTec to mark codes assigned:</div><div style={{display:"flex",gap:6}}><input placeholder="SR#" value={point.srNumber||""} onChange={e=>updPoint(proj.id,point.id,{srNumber:e.target.value})} style={{flex:1,padding:"7px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,fontFamily:"monospace"}}/><Btn sz="sm" onClick={()=>{if(point.srNumber)updPoint(proj.id,point.id,{status:"codes_assigned"});}}>Assign Codes</Btn></div></div>}
       {point.status==="codes_assigned"&&<Btn v="primary" onClick={()=>updPoint(proj.id,point.id,{status:"billed"})}>Mark as Billed</Btn>}
      </div>
      {/* Tech & date */}
      <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>TECHNICIAN</div><select value={point.tech?.id||""} onChange={e=>{const t=proj.techs.find(t=>t.id===e.target.value);updPoint(proj.id,point.id,{tech:t||null});}} style={{width:"100%",padding:"7px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11}}><option value="">Unassigned</option>{proj.techs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>DATE</div><input type="date" value={point.date||""} onChange={e=>updPoint(proj.id,point.id,{date:e.target.value})} style={{width:"100%",padding:"7px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11}}/></div>
       </div>
      </div>
      {/* Notes */}
      <div style={{marginTop:10}}><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>NOTES</div><textarea value={point.notes||""} onChange={e=>updPoint(proj.id,point.id,{notes:e.target.value})} rows={2} placeholder="Splice notes..." style={{width:"100%",padding:"7px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11,resize:"vertical",boxSizing:"border-box"}}/></div>
     </Card>
    </div>
   </div>
  </div>;
 }

 // ── PROJECT DETAIL VIEW ──
 if(!proj)return null;
 const points=proj.splicePoints;
 const filteredPoints=(()=>{
  let fp=[...points];
  if(pointFilter!=="all")fp=fp.filter(sp=>sp.status===pointFilter);
  if(pointSearch.trim())fp=fp.filter(sp=>sp.id.toLowerCase().includes(pointSearch.toLowerCase())||(sp.tech?.name||"").toLowerCase().includes(pointSearch.toLowerCase()));
  return fp;
 })();

 // Debrief report aggregation
 const debriefTotals=(()=>{
  const totals={};SPLICE_BILLING_CODES.forEach(bc=>{totals[bc.code]=0;});
  points.forEach(sp=>{Object.entries(sp.codes||{}).forEach(([k,v])=>{totals[k]=(totals[k]||0)+v;});});
  return totals;
 })();

 const totalPhotos=points.reduce((s,sp)=>s+(sp.photos?.length||0),0);
 const completedPts=points.filter(sp=>sp.status==="codes_assigned"||sp.status==="billed").length;
 const allStatuses=Object.keys(SPLICE_PT_STATUS);

 return <div>
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
   <Btn v="ghost" sz="sm" onClick={()=>{setSelProject(null);setSelPoint(null);}}>← All Projects</Btn>
   <div style={{flex:1}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
     <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>{proj.wireCenter}</h1>
     <Badge label={proj.status==="active"?"Active":"Complete"} color={T.success} bg={T.successSoft}/>
    </div>
    <p style={{color:T.textMuted,fontSize:12,margin:"2px 0 0"}}>{proj.location} · {proj.customer} · {proj.client} · {points.length} splice points · {totalPhotos} photos</p>
   </div>
  </div>

  <TabBar tabs={[{key:"overview",label:"Overview"},{key:"splice_points",label:`Splice Points (${points.length})`},{key:"debrief",label:"Debrief Report"},{key:"photos",label:`Photo Gallery (${totalPhotos})`}]} active={tab} onChange={setTab}/>

  {/* ── OVERVIEW TAB ── */}
  {tab==="overview"&&<div>
   {/* Stats row */}
   <div style={{display:"grid",gridTemplateColumns:"repeat(5, 1fr)",gap:12,marginBottom:16}}>
    {[{l:"Total Points",v:points.length,c:T.accent},{l:"Completed",v:completedPts,c:T.success},{l:"In Progress",v:points.filter(sp=>sp.status==="in_progress"||sp.status==="photos_needed"||sp.status==="ready_for_billing").length,c:T.warning},{l:"Not Started",v:points.filter(sp=>sp.status==="not_started").length,c:T.textDim},{l:"Total Photos",v:totalPhotos,c:T.purple}].map((s,i)=>
     <Card key={i}><div style={{fontSize:24,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.l}</div></Card>
    )}
   </div>

   {/* Billing code summary */}
   <Card>
    <h3 style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Billing Code Totals</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:8}}>
     {SPLICE_BILLING_CODES.map(bc=>{const qty=debriefTotals[bc.code]||0;
      return <div key={bc.code} style={{padding:"10px 12px",borderRadius:6,background:qty>0?T.accentSoft:T.bgInput,border:`1px solid ${qty>0?T.accent+"20":T.border}`}}>
       <div style={{fontSize:20,fontWeight:700,color:qty>0?T.accent:T.textDim,fontFamily:"monospace"}}>{qty}</div>
       <div style={{fontSize:11,fontWeight:600,color:T.text,marginTop:2}}>{bc.short}</div>
       <div style={{fontSize:9,color:T.textDim,fontFamily:"monospace"}}>{bc.code}</div>
      </div>;
     })}
    </div>
   </Card>

   {/* Recent activity */}
   <Card style={{marginTop:12}}>
    <h3 style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>Splice Points Needing Attention</h3>
    {points.filter(sp=>sp.status==="in_progress"||sp.status==="ready_for_billing"||sp.status==="photos_needed").slice(0,8).map(sp=>{
     const stCfg=SPLICE_PT_STATUS[sp.status]||SPLICE_PT_STATUS.not_started;const reqMissing=SPLICE_PHOTO_TYPES.filter(p=>p.required&&!(sp.photos||[]).some(ph=>ph.type===p.key)).length;
     return <div key={sp.id} className="card-hover" onClick={()=>setSelPoint(sp.id)} style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}08`,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
      <span style={{fontWeight:700,fontFamily:"monospace",fontSize:12,color:T.accent,width:100}}>{sp.id}</span>
      <span style={{padding:"2px 8px",borderRadius:3,fontSize:10,fontWeight:600,color:stCfg.c,background:stCfg.bg}}>{stCfg.l}</span>
      <span style={{fontSize:11,color:T.textMuted,flex:1}}>{sp.tech?.name||"Unassigned"}</span>
      {reqMissing>0&&<span style={{fontSize:10,color:T.warning,fontWeight:600}}>{reqMissing} photos needed</span>}
      <span style={{fontSize:11,color:T.textDim}}>→</span>
     </div>;
    })}
    {points.filter(sp=>sp.status==="in_progress"||sp.status==="ready_for_billing").length===0&&<div style={{padding:24,textAlign:"center",color:T.textDim,fontSize:12}}>No items needing attention</div>}
   </Card>
  </div>}

  {/* ── SPLICE POINTS TAB ── */}
  {tab==="splice_points"&&<div>
   <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
    <button onClick={()=>setPointFilter("all")} style={{padding:"5px 12px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:pointFilter==="all"?`1.5px solid ${T.accent}`:`1px solid ${T.border}`,background:pointFilter==="all"?T.accentSoft:"transparent",color:pointFilter==="all"?T.accent:T.textMuted}}>All ({points.length})</button>
    {allStatuses.map(sk=>{const cfg=SPLICE_PT_STATUS[sk];const c=points.filter(sp=>sp.status===sk).length;if(c===0)return null;
     return <button key={sk} onClick={()=>setPointFilter(pointFilter===sk?"all":sk)} style={{padding:"5px 12px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:pointFilter===sk?`1.5px solid ${cfg.c}`:`1px solid ${T.border}`,background:pointFilter===sk?cfg.bg:"transparent",color:pointFilter===sk?cfg.c:T.textMuted}}>{cfg.l} ({c})</button>;
    }).filter(Boolean)}
    <div style={{flex:1}}/>
    <input value={pointSearch} onChange={e=>setPointSearch(e.target.value)} placeholder="Search splice points..." style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11,width:180}}/>
    <Btn sz="sm" onClick={()=>setAddPointOpen(!addPointOpen)}>+ Add Point</Btn>
   </div>

   {addPointOpen&&<Card style={{marginBottom:12,borderColor:T.accent+"44"}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"end"}}>
     <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>SPLICE POINT ID</div><input value={newPoint.id} onChange={e=>setNewPoint({...newPoint,id:e.target.value})} placeholder="e.g. TML.001.9.1" style={{width:"100%",padding:"7px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,fontFamily:"monospace",boxSizing:"border-box"}}/></div>
     <div><div style={{fontSize:10,fontWeight:600,color:T.textMuted,marginBottom:3}}>TYPE</div><select value={newPoint.type} onChange={e=>setNewPoint({...newPoint,type:e.target.value})} style={{width:"100%",padding:"7px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}><option value="tml">Terminal (TML)</option><option value="bspd">Distribution (BSPD)</option></select></div>
     <Btn sz="sm" onClick={()=>{if(!newPoint.id.trim()||points.some(p=>p.id===newPoint.id.trim()))return;updProject(proj.id,p=>({splicePoints:[...p.splicePoints,{id:newPoint.id.trim(),type:newPoint.type,status:"not_started",tech:null,date:null,codes:{},srNumber:null,photos:[],notes:"",fusionCount:0,ribbonCount:0}]}));setNewPoint({id:"",type:"tml"});setAddPointOpen(false);}}>Add</Btn>
    </div>
   </Card>}

   <Card style={{padding:0,overflow:"hidden"}}>
    <DT columns={[
     {key:"sp_id",label:"Splice Point",render:r=><span style={{fontWeight:700,fontFamily:"monospace",fontSize:12,color:T.accent}}>{r.id}</span>},
     {key:"sp_type",label:"Type",render:r=><span style={{fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase"}}>{r.type}</span>},
     {key:"sp_status",label:"Status",render:r=>{const cfg=SPLICE_PT_STATUS[r.status]||SPLICE_PT_STATUS.not_started;return <span style={{padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,color:cfg.c,background:cfg.bg}}>{cfg.l}</span>;}},
     {key:"sp_tech",label:"Tech",render:r=><span style={{fontSize:12,color:r.tech?T.text:T.textDim}}>{r.tech?.name||"—"}</span>},
     {key:"sp_photos",label:"Photos",render:r=>{const req=SPLICE_PHOTO_TYPES.filter(p=>p.required).length;const has=(r.photos||[]).length;const pct=Math.round((Math.min(has,req)/req)*100);return <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:40,height:4,borderRadius:2,background:T.bgInput,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:pct===100?T.success:T.warning}}/></div><span style={{fontSize:10,color:T.textMuted}}>{has}/{req}</span></div>;}},
     {key:"sp_codes",label:"Codes",render:r=>{const total=Object.values(r.codes||{}).reduce((s,v)=>s+v,0);return <span style={{fontSize:11,color:total>0?T.text:T.textDim,fontFamily:"monospace"}}>{total}</span>;}},
     {key:"sp_sr",label:"SR#",render:r=>r.srNumber?<span style={{fontSize:11,fontFamily:"monospace",color:T.success}}>{r.srNumber}</span>:<span style={{color:T.textDim}}>—</span>},
    ]} data={filteredPoints} onRowClick={r=>setSelPoint(r.id)}/>
   </Card>
  </div>}

  {/* ── DEBRIEF REPORT TAB ── */}
  {tab==="debrief"&&<div>
   <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
     <div>
      <h3 style={{fontSize:14,fontWeight:700,color:T.text,margin:0}}>Splicing Debrief Report</h3>
      <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Wire Center: {proj.wireCenter} · {proj.location}</div>
     </div>
     <Btn onClick={()=>setDebriefExporting(true)}>Export to Excel</Btn>
    </div>

    {/* Header row mimicking the Excel */}
    <div style={{overflowX:"auto"}}>
     <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
      <thead>
       <tr style={{borderBottom:`2px solid ${T.border}`}}>
        <th style={{padding:"8px 10px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10,letterSpacing:0.3}}>SPLICE POINT</th>
        <th style={{padding:"8px 10px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10}}>TECH</th>
        <th style={{padding:"8px 10px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10}}>DATE</th>
        <th style={{padding:"8px 10px",textAlign:"left",color:T.textMuted,fontWeight:600,fontSize:10}}>SR#</th>
        {SPLICE_BILLING_CODES.map(bc=><th key={bc.code} style={{padding:"8px 6px",textAlign:"center",color:T.accent,fontWeight:700,fontSize:9,fontFamily:"monospace",minWidth:50}}>{bc.code.replace("BSPD","")}</th>)}
        <th style={{padding:"8px 10px",textAlign:"center",color:T.textMuted,fontWeight:600,fontSize:10}}>PHOTOS</th>
       </tr>
      </thead>
      <tbody>
       {points.map(sp=>{const stCfg=SPLICE_PT_STATUS[sp.status]||SPLICE_PT_STATUS.not_started;
        return <tr key={sp.id} className="card-hover" onClick={()=>setSelPoint(sp.id)} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>
         <td style={{padding:"7px 10px",fontWeight:700,fontFamily:"monospace",color:T.accent,fontSize:12}}>{sp.id}</td>
         <td style={{padding:"7px 10px",color:T.text}}>{sp.tech?.name||"—"}</td>
         <td style={{padding:"7px 10px",color:T.textMuted}}>{sp.date||"—"}</td>
         <td style={{padding:"7px 10px",fontFamily:"monospace",color:sp.srNumber?T.success:T.textDim,fontSize:11}}>{sp.srNumber||"—"}</td>
         {SPLICE_BILLING_CODES.map(bc=>{const v=sp.codes?.[bc.code]||0;return <td key={bc.code} style={{padding:"7px 6px",textAlign:"center",fontFamily:"monospace",fontWeight:v>0?700:400,color:v>0?T.text:T.textDim,fontSize:12}}>{v||""}</td>;})}
         <td style={{padding:"7px 10px",textAlign:"center"}}><span style={{fontSize:10,fontWeight:600,color:stCfg.c}}>{(sp.photos||[]).length}</span></td>
        </tr>;
       })}
       {/* Totals row */}
       <tr style={{borderTop:`2px solid ${T.accent}`,background:T.accentSoft}}>
        <td colSpan={4} style={{padding:"8px 10px",fontWeight:700,color:T.accent,fontSize:12}}>TOTAL</td>
        {SPLICE_BILLING_CODES.map(bc=><td key={bc.code} style={{padding:"8px 6px",textAlign:"center",fontFamily:"monospace",fontWeight:700,color:T.accent,fontSize:13}}>{debriefTotals[bc.code]||""}</td>)}
        <td style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:T.accent}}>{totalPhotos}</td>
       </tr>
      </tbody>
     </table>
    </div>
   </Card>
  </div>}

  {/* ── PHOTO GALLERY TAB ── */}
  {tab==="photos"&&<div>
   <Card>
    <h3 style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>All Photos — {proj.wireCenter}</h3>
    {points.filter(sp=>(sp.photos||[]).length>0).map(sp=>
     <div key={sp.id} style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}} onClick={()=>setSelPoint(sp.id)}>
       <span style={{fontWeight:700,fontFamily:"monospace",fontSize:12,color:T.accent}}>{sp.id}</span>
       <span style={{fontSize:11,color:T.textMuted}}>· {(sp.photos||[]).length} photos · {sp.tech?.name||"Unknown"}</span>
       <span style={{fontSize:11,color:T.textDim}}>→</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",gap:8}}>
       {(sp.photos||[]).map((ph,i)=>{
        const ptCfg=SPLICE_PHOTO_TYPES.find(p=>p.key===ph.type)||{label:ph.type};
        return <div key={i} style={{padding:"10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,textAlign:"center"}}>
         <div style={{width:"100%",height:80,borderRadius:4,background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:6}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
         </div>
         <div style={{fontSize:10,fontWeight:600,color:T.text}}>{ptCfg.label}</div>
         <div style={{fontSize:9,color:T.textMuted}}>{ph.techName} · {new Date(ph.uploadedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
        </div>;
       })}
      </div>
     </div>
    )}
    {totalPhotos===0&&<div style={{padding:40,textAlign:"center",color:T.textDim}}>No photos uploaded yet.</div>}
   </Card>
  </div>}
 </div>;
}

// ─── COMPLIANCE DASHBOARD ────────────────────────────────────────────────────
function ComplianceView(){
 const{trucks,setTrucks,drills,setDrills}=useApp();
 const[tab,setTab]=useState("alerts");
 const[editItem,setEditItem]=useState(null);
 const[editDate,setEditDate]=useState("");
 const now=new Date();

 const saveCompDate=()=>{
  if(!editItem||!editDate)return;
  const{asset,type,category}=editItem;
  if(category==="truck"){
   setTrucks(prev=>prev.map(t=>{if(t.id!==asset)return t;const c={...t.compliance};
   if(type==="DOT Inspection")c.dotInspection={...c.dotInspection,expires:editDate};
   if(type==="Insurance")c.insurance={...c.insurance,expires:editDate};
   if(type==="Registration")c.registration={...c.registration,expires:editDate};
   if(type==="Oil Change Due")c.oilChange={...c.oilChange,nextDue:editDate};
   if(type==="Tire Inspection")c.tireInspection={...c.tireInspection,nextDue:editDate};
   return{...t,compliance:c};}));
  }
  if(category==="drill"){
   setDrills(prev=>prev.map(d=>{if(d.id!==asset)return d;const c={...d.compliance};
   if(type==="Service Due")c.lastService={...c.lastService,nextDue:editDate};
   if(type==="Hydraulic Inspection")c.hydraulicInspection={...c.hydraulicInspection,nextDue:editDate};
   if(type==="Bit Replacement")c.bitReplacement={...c.bitReplacement,nextDue:editDate};
   return{...d,compliance:c};}));
  }
  setEditItem(null);setEditDate("");
 };

 // Gather all compliance items
 const items=useMemo(()=>{
 const all=[];
 trucks.forEach(t=>{
 const c=t.compliance;if(!c)return;
 all.push({asset:t.id,assetLabel:t.label,type:"DOT Inspection",expires:c.dotInspection?.expires,category:"truck"});
 all.push({asset:t.id,assetLabel:t.label,type:"Insurance",expires:c.insurance?.expires,detail:c.insurance?.provider+" · "+c.insurance?.policy,category:"truck"});
 all.push({asset:t.id,assetLabel:t.label,type:"Registration",expires:c.registration?.expires,detail:c.registration?.state,category:"truck"});
 all.push({asset:t.id,assetLabel:t.label,type:"Oil Change Due",expires:c.oilChange?.nextDue,detail:c.oilChange?.mileage?`${c.oilChange.mileage.toLocaleString()} mi`:"",category:"truck"});
 all.push({asset:t.id,assetLabel:t.label,type:"Tire Inspection",expires:c.tireInspection?.nextDue,category:"truck"});
 });
 drills.forEach(d=>{
 const c=d.compliance;if(!c)return;
 all.push({asset:d.id,assetLabel:d.label,type:"Service Due",expires:c.lastService?.nextDue,detail:c.lastService?.hours?`${c.lastService.hours} hrs`:"",category:"drill"});
 all.push({asset:d.id,assetLabel:d.label,type:"Hydraulic Inspection",expires:c.hydraulicInspection?.nextDue,category:"drill"});
 all.push({asset:d.id,assetLabel:d.label,type:"Bit Replacement",expires:c.bitReplacement?.nextDue,detail:`${c.bitReplacement?.bitsUsed||0} bits used`,category:"drill"});
 });
 // CDL items
 Object.entries(CDL_DATA).forEach(([uid,cdl])=>{
 const u=USERS.find(u=>u.id===uid);if(!u)return;
 all.push({asset:uid,assetLabel:u.name,type:"CDL License",expires:cdl.expires,detail:`Class ${cdl.cdlClass} · ${cdl.cdlNumber}`,category:"cdl"});
 all.push({asset:uid,assetLabel:u.name,type:"Medical Card",expires:cdl.medicalCard?.expires,category:"cdl"});
 });
 return all.map(i=>({...i,status:complianceStatus(i.expires)})).sort((a,b)=>(a.status.days??999)-(b.status.days??999));
 },[trucks,drills]);

 const alerts=items.filter(i=>i.status.status==="expired"||i.status.status==="critical"||i.status.status==="warning");
 const expired=items.filter(i=>i.status.status==="expired");
 const critical=items.filter(i=>i.status.status==="critical");
 const warning=items.filter(i=>i.status.status==="warning");

 const truckItems=items.filter(i=>i.category==="truck");
 const drillItems=items.filter(i=>i.category==="drill");
 const cdlItems=items.filter(i=>i.category==="cdl");

 const CompRow=({item})=><div onClick={()=>{if(item.category!=="cdl"){setEditItem(item);setEditDate(item.expires||"");}}} className="card-hover" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:`1px solid ${T.border}`,transition:"background 0.1s",cursor:item.category!=="cdl"?"pointer":"default"}}>
 <div style={{display:"flex",alignItems:"center",gap:12,flex:1}}>
 <div style={{width:8,height:8,borderRadius:"50%",background:item.status.color,flexShrink:0}}/>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{item.type}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{item.assetLabel}{item.detail?" · "+item.detail:""}</div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:12,fontWeight:600,color:item.status.color}}>{item.status.label}</div>
 {item.expires&&<div style={{fontSize:10,color:T.textDim}}>{fd(item.expires)}</div>}
 </div>
 {item.category!=="cdl"&&<span style={{color:T.accent,fontSize:12,opacity:0.8}}>✎</span>}
 </div>
 </div>;

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
 <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Compliance & Maintenance</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>DOT inspections, insurance, CDL tracking, equipment maintenance</p>
 </div>
 </div>

 {/* Summary cards */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
 <Card style={{padding:16,borderLeft:`3px solid ${T.danger}`}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Expired</div><div style={{fontSize:28,fontWeight:600,color:expired.length>0?T.danger:T.success,marginTop:4}}>{expired.length}</div><div style={{fontSize:11,color:T.textDim}}>needs immediate action</div></Card>
 <Card style={{padding:16,borderLeft:`3px solid ${T.danger}`}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Critical (&lt;7 days)</div><div style={{fontSize:28,fontWeight:600,color:critical.length>0?T.danger:T.success,marginTop:4}}>{critical.length}</div><div style={{fontSize:11,color:T.textDim}}>expiring this week</div></Card>
 <Card style={{padding:16,borderLeft:`3px solid ${T.warning}`}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Warning (&lt;30 days)</div><div style={{fontSize:28,fontWeight:600,color:warning.length>0?T.warning:T.success,marginTop:4}}>{warning.length}</div><div style={{fontSize:11,color:T.textDim}}>schedule maintenance</div></Card>
 <Card style={{padding:16,borderLeft:`3px solid ${T.success}`}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>All Items</div><div style={{fontSize:28,fontWeight:600,color:T.text,marginTop:4}}>{items.length}</div><div style={{fontSize:11,color:T.textDim}}>{items.filter(i=>i.status.status==="good").length} in good standing</div></Card>
 </div>

 {/* Tabs */}
 <div style={{display:"flex",gap:4,marginBottom:16}}>
 {[{k:"alerts",l:"Alerts",n:alerts.length,c:alerts.length>0?T.danger:T.success},{k:"trucks",l:"Trucks",n:truckItems.length},{k:"drills",l:"Drills",n:drillItems.length},{k:"cdl",l:"CDL / Drivers",n:cdlItems.length}].map(t=>
 <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",borderRadius:4,border:`1px solid ${tab===t.k?T.accent:T.border}`,background:tab===t.k?T.accentSoft:"transparent",color:tab===t.k?T.accent:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
 {t.l} <span style={{marginLeft:4,opacity:0.7}}>({t.n})</span>
 {t.k==="alerts"&&false&&<span style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:T.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{alerts.length}</span>}
 </button>
 )}
 </div>

 {tab==="alerts"&&<Card style={{padding:0,overflow:"hidden"}}>
 {alerts.length===0?<div style={{padding:32,textAlign:"center",color:T.success}}><div style={{fontSize:24,marginBottom:8}}>✓</div><div style={{fontSize:14,fontWeight:600}}>All Clear</div><div style={{fontSize:12,color:T.textMuted}}>No compliance items need attention</div></div>
 :alerts.map((item,i)=><CompRow key={i} item={item}/>)}
 </Card>}

 {tab==="trucks"&&<div>
 {trucks.map(t=>{
 const c=t.compliance;if(!c)return null;
 return <Card key={t.id} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{fontSize:14,fontWeight:600,color:T.text}}>{t.label}</div>
 <div style={{fontSize:11,color:T.textMuted}}>VIN: {t.vin} · Owner: {t.investorName||"Company"}</div>
 </div>
 {(()=>{const worst=["dotInspection","insurance","registration","oilChange","tireInspection"].map(k=>{const exp=k==="oilChange"?c.oilChange?.nextDue:k==="tireInspection"?c.tireInspection?.nextDue:c[k]?.expires;return complianceStatus(exp);}).sort((a,b)=>(a.days??999)-(b.days??999))[0];
 return <Badge label={worst.status==="good"?"Compliant":worst.status==="expired"?"Action Required":"Attention"} color={worst.color} bg={worst.color+"18"}/>;})()}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)"}}>
 {[
 {l:"DOT Inspection",d:c.dotInspection?.expires},
 {l:"Insurance",d:c.insurance?.expires},
 {l:"Registration",d:c.registration?.expires},
 {l:"Oil Change",d:c.oilChange?.nextDue},
 {l:"Tires",d:c.tireInspection?.nextDue},
 ].map((x,i)=>{const s=complianceStatus(x.d);return <div key={i} style={{padding:"12px 14px",textAlign:"center",borderRight:i<4?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{x.l}</div>
 <div style={{fontSize:12,fontWeight:600,color:s.color}}>{s.label}</div>
 <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{x.d?fd(x.d):"—"}</div>
 </div>;})}
 </div>
 </Card>;
 })}
 </div>}

 {tab==="drills"&&<div>
 {drills.map(d=>{
 const c=d.compliance;if(!c)return null;
 return <Card key={d.id} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{fontSize:14,fontWeight:600,color:T.text}}>{d.label}</div>
 <div style={{fontSize:11,color:T.textMuted}}>Owner: {d.investorName||"Company"}</div>
 </div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)"}}>
 {[
 {l:"Service Due",d:c.lastService?.nextDue,detail:c.lastService?.hours?`${c.lastService.hours} hrs`:null},
 {l:"Hydraulic Insp.",d:c.hydraulicInspection?.nextDue},
 {l:"Bit Replacement",d:c.bitReplacement?.nextDue,detail:`${c.bitReplacement?.bitsUsed||0} bits used`},
 ].map((x,i)=>{const s=complianceStatus(x.d);return <div key={i} style={{padding:"12px 14px",textAlign:"center",borderRight:i<2?`1px solid ${T.border}`:"none"}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{x.l}</div>
 <div style={{fontSize:12,fontWeight:600,color:s.color}}>{s.label}</div>
 <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{x.d?fd(x.d):"—"}</div>
 {x.detail&&<div style={{fontSize:10,color:T.textDim}}>{x.detail}</div>}
 </div>;})}
 </div>
 </Card>;
 })}
 </div>}

 {tab==="cdl"&&<div>
 {Object.entries(CDL_DATA).map(([uid,cdl])=>{
 const u=USERS.find(u=>u.id===uid);if(!u)return null;
 const cdlS=complianceStatus(cdl.expires);
 const medS=complianceStatus(cdl.medicalCard?.expires);
 return <Card key={uid} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:36,height:36,borderRadius:4,background:`${T.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:T.accent}}>
 {u.name.split(" ").map(n=>n[0]).join("")}
 </div>
 <div>
 <div style={{fontSize:14,fontWeight:600,color:T.text}}>{u.name}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{u.role.replace("_"," ")} · {cdl.cdlNumber}</div>
 </div>
 </div>
 <Badge label={`Class ${cdl.cdlClass}`} color={T.accent} bg={T.accentSoft}/>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
 <div style={{padding:"12px 14px",textAlign:"center",borderRight:`1px solid ${T.border}`}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>CDL Expires</div>
 <div style={{fontSize:12,fontWeight:600,color:cdlS.color}}>{cdlS.label}</div>
 <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{fd(cdl.expires)}</div>
 </div>
 <div style={{padding:"12px 14px",textAlign:"center",borderRight:`1px solid ${T.border}`}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Medical Card</div>
 <div style={{fontSize:12,fontWeight:600,color:medS.color}}>{medS.label}</div>
 <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{fd(cdl.medicalCard?.expires)}</div>
 </div>
 <div style={{padding:"12px 14px",textAlign:"center"}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Endorsements</div>
 <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:4}}>
 {cdl.endorsements.length>0?cdl.endorsements.map(e=><Badge key={e} label={e} color={T.accent} bg={T.accentSoft}/>):<span style={{fontSize:12,color:T.textDim}}>None</span>}
 </div>
 </div>
 </div>
 </Card>;
 })}
 </div>}

 <Modal open={!!editItem} onClose={()=>setEditItem(null)} title={`Update ${editItem?.type||""}`} width={380}>
 {editItem&&<div>
 <p style={{fontSize:13,color:T.textMuted,marginBottom:12}}>Asset: <b style={{color:T.accent}}>{editItem.assetLabel}</b></p>
 <p style={{fontSize:12,color:T.textMuted,marginBottom:4}}>Current: <span style={{color:editItem.status.color,fontWeight:600}}>{editItem.status.label}</span>{editItem.expires?` (${fd(editItem.expires)})`:""}</p>
 <div style={{marginBottom:12}}>
 <label style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.3,display:"block",marginBottom:3}}>New Date</label>
 <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/>
 </div>
 <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="ghost" onClick={()=>setEditItem(null)}>Cancel</Btn><Btn onClick={saveCompDate} disabled={!editDate}>Save</Btn></div>
 </div>}
 </Modal>
 </div>;
}

// ─── REPORTS & P&L ──────────────────────────────────────────────────────────
function ReportsView(){
 const{jobs,rateCards,trucks,drills,pickups,invoices,payrollRuns,companyConfig}=useApp();
 const[tab,setTab]=useState("pnl");
 const[period,setPeriod]=useState("month");
 const[filterClient,setFilterClient]=useState("all");
 const[filterRegion,setFilterRegion]=useState("all");

 const now=new Date();
 const periodStart=useMemo(()=>{
  const d=new Date(now);
  if(period==="week"){d.setDate(d.getDate()-d.getDay());d.setHours(0,0,0,0);}
  else if(period==="month"){d.setDate(1);d.setHours(0,0,0,0);}
  else if(period==="quarter"){d.setMonth(d.getMonth()-d.getMonth()%3,1);d.setHours(0,0,0,0);}
  else if(period==="year"){d.setMonth(0,1);d.setHours(0,0,0,0);}
  else return new Date(0);
  return d;
 },[period]);

 // Filter jobs for period
 const periodJobs=useMemo(()=>{
  return jobs.filter(j=>{
   if(!j.production)return false;
   const jd=new Date(j.completedAt||j.createdAt);
   if(period!=="all"&&jd<periodStart)return false;
   if(filterClient!=="all"&&j.client!==filterClient)return false;
   if(filterRegion!=="all"&&j.region!==filterRegion)return false;
   return true;
  });
 },[jobs,periodStart,filterClient,filterRegion,period]);

 // P&L calculations
 const pnl=useMemo(()=>{
  let revenue=0,laborCost=0,investorCost=0,materialCost=0;
  const byCustomer={},byRegion={},byCrew={};
  periodJobs.forEach(j=>{
   const calc=calcJob(j,rateCards);
   if(calc.status!=="Calculated"||!calc.totals)return;
   const t=calc.totals;
   revenue+=t.nextgenRevenue;
   laborCost+=t.linemanPay||0;
   investorCost+=t.investorCommission||0;
   // Material cost
   let matCost=0;
   if(j.department==="aerial"){(j.production.spans||[]).forEach(sp=>{
    const ft=sp.strandSpan||0;const wts=sp.workTypes||[];
    if(wts.includes("Strand"))matCost+=ft*MATERIALS.find(m=>m.id==="mat-strand")?.unitCost||0;
    if(wts.includes("Fiber"))matCost+=ft*MATERIALS.find(m=>m.id==="mat-fiber48")?.unitCost||0;
    if(sp.anchor)matCost+=MATERIALS.find(m=>m.id==="mat-anchor")?.unitCost||0;
    if(sp.coil)matCost+=MATERIALS.find(m=>m.id==="mat-coil")?.unitCost||0;
   });}
   materialCost+=matCost;
   // By customer
   const ck=j.customer||"Unknown";
   if(!byCustomer[ck])byCustomer[ck]={revenue:0,jobs:0,feet:0};
   byCustomer[ck].revenue+=t.nextgenRevenue;byCustomer[ck].jobs++;byCustomer[ck].feet+=j.production?.totalFeet||0;
   // By region
   const rk=j.region||"Unknown";
   if(!byRegion[rk])byRegion[rk]={revenue:0,jobs:0,feet:0};
   byRegion[rk].revenue+=t.nextgenRevenue;byRegion[rk].jobs++;byRegion[rk].feet+=j.production?.totalFeet||0;
   // By crew
   const crewId=j.assignedLineman;const crew=crewId?USERS.find(u=>u.id===crewId):null;
   const crewName=crew?.name||"Unassigned";
   if(!byCrew[crewName])byCrew[crewName]={revenue:0,jobs:0,feet:0,role:crew?.role||""};
   byCrew[crewName].revenue+=t.nextgenRevenue;byCrew[crewName].jobs++;byCrew[crewName].feet+=j.production?.totalFeet||0;
  });
  const grossProfit=revenue-laborCost-investorCost-materialCost;
  const margin=revenue>0?(grossProfit/revenue*100):0;
  return{revenue,laborCost,investorCost,materialCost,grossProfit,margin,byCustomer,byRegion,byCrew,
   totalJobs:periodJobs.length,totalFeet:periodJobs.reduce((s,j)=>s+(j.production?.totalFeet||0),0)};
 },[periodJobs,rateCards]);

 const regions=[...new Set(jobs.map(j=>j.region).filter(Boolean))];

 // Excel export
 const exportExcel=(sheetName,data,headers)=>{
   const esc=(v)=>{const s=String(v??"");return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'""')}"`:s;};
   const csv="\uFEFF"+[headers.map(esc).join(","),...data.map(r=>r.map(esc).join(","))].join("\r\n");
   const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download=`Fiberlytic_${sheetName.replace(/\s/g,"_")}_${new Date().toISOString().split("T")[0]}.csv`;
   document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
 };

 const exportPnl=()=>exportExcel("P&L",[
  ["Revenue","","",pnl.revenue.toFixed(2)],
  ["","Labor Cost","",(-pnl.laborCost).toFixed(2)],
  ["","Equipment Owner Cost","",(-pnl.investorCost).toFixed(2)],
  ["","Material Cost","",(-pnl.materialCost).toFixed(2)],
  ["Gross Profit","","",pnl.grossProfit.toFixed(2)],
  ["Margin","","",pnl.margin.toFixed(1)+"%"],
  [],["Jobs Completed","","",pnl.totalJobs],["Total Footage","","",pnl.totalFeet],
 ],["Category","Subcategory","","Amount"]);

 const exportCustomer=()=>exportExcel("By_Customer",
  Object.entries(pnl.byCustomer).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,d])=>[name,d.jobs,d.feet,d.revenue.toFixed(2),d.feet>0?(d.revenue/d.feet).toFixed(2):"0"]),
  ["Customer","Jobs","Footage","Revenue","$/ft"]);

 const exportCrew=()=>exportExcel("Crew_Productivity",
  Object.entries(pnl.byCrew).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,d])=>[name,d.role,d.jobs,d.feet,d.revenue.toFixed(2),d.jobs>0?Math.round(d.feet/d.jobs):0]),
  ["Crew Member","Role","Jobs","Footage","Revenue","Avg Ft/Job"]);

 const exportRegion=()=>exportExcel("By_Region",
  Object.entries(pnl.byRegion).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,d])=>[name,d.jobs,d.feet,d.revenue.toFixed(2)]),
  ["Region","Jobs","Footage","Revenue"]);

 const exportJobDetail=()=>exportExcel("Job_Detail",
  periodJobs.map(j=>{const c=calcJob(j,rateCards);const t=c.totals||{};
   return[j.id,j.feederId,j.client,j.customer,j.region,j.department,j.status,j.production?.totalFeet||0,
   (t.nextgenRevenue||0).toFixed(2),(t.linemanPay||0).toFixed(2),(t.investorCommission||0).toFixed(2),
   j.assignedLineman?USERS.find(u=>u.id===j.assignedLineman)?.name||"":"",j.assignedTruck||j.assignedDrill||"",
   j.completedAt||"",j.srNumber||""];}),
  ["Job ID","Feeder","Client","Customer","Region","Dept","Status","Footage","Revenue","Labor","Equipment Owner","Crew","Equipment","Completed","SR#"]);

 const periodLabel={week:"This Week",month:"This Month",quarter:"This Quarter",year:"This Year",all:"All Time"};

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
 <div><h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Reports & Analytics</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>P&L, crew productivity, customer breakdown — {periodLabel[period]}</p></div>
 <div style={{display:"flex",gap:6}}>
 {[{k:"week",l:"W"},{k:"month",l:"M"},{k:"quarter",l:"Q"},{k:"year",l:"Y"},{k:"all",l:"All"}].map(p=>
 <button key={p.k} onClick={()=>setPeriod(p.k)} style={{width:32,height:32,borderRadius:4,border:`1px solid ${period===p.k?T.accent:T.border}`,background:period===p.k?T.accentSoft:"transparent",color:period===p.k?T.accent:T.textMuted,fontSize:11,fontWeight:700,cursor:"pointer"}}>{p.l}</button>)}
 </div>
 </div>

 {/* Filters */}
 <div style={{display:"flex",gap:8,marginBottom:16}}>
 <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{padding:"6px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>
 <option value="all">All Clients</option>{CLIENTS.map(c=><option key={c} value={c}>{c}</option>)}
 </select>
 <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} style={{padding:"6px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}>
 <option value="all">All Regions</option>{regions.map(r=><option key={r} value={r}>{r}</option>)}
 </select>
 </div>

 {/* P&L Summary */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:20}}>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Revenue</div><div style={{fontSize:22,fontWeight:700,color:T.success,marginTop:4}}>{$(pnl.revenue)}</div><div style={{fontSize:10,color:T.textDim}}>{pnl.totalJobs} jobs</div></Card>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Labor</div><div style={{fontSize:22,fontWeight:700,color:T.danger,marginTop:4}}>-{$(pnl.laborCost)}</div><div style={{fontSize:10,color:T.textDim}}>crew payroll</div></Card>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>{companyConfig?.equipmentOwnerLabel||"Investor"}</div><div style={{fontSize:22,fontWeight:700,color:T.orange,marginTop:4}}>-{$(pnl.investorCost)}</div><div style={{fontSize:10,color:T.textDim}}>equipment commissions</div></Card>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Materials</div><div style={{fontSize:22,fontWeight:700,color:T.warning,marginTop:4}}>-{$(pnl.materialCost)}</div><div style={{fontSize:10,color:T.textDim}}>consumed on jobs</div></Card>
 <Card style={{padding:14,borderLeft:`3px solid ${pnl.grossProfit>=0?T.success:T.danger}`}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Gross Profit</div><div style={{fontSize:22,fontWeight:700,color:pnl.grossProfit>=0?T.success:T.danger,marginTop:4}}>{$(pnl.grossProfit)}</div><div style={{fontSize:10,color:T.textDim}}>{pnl.margin.toFixed(1)}% margin</div></Card>
 <Card style={{padding:14}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Footage</div><div style={{fontSize:22,fontWeight:700,color:T.text,marginTop:4}}>{pnl.totalFeet>=1000?`${(pnl.totalFeet/1000).toFixed(1)}k`:pnl.totalFeet}</div><div style={{fontSize:10,color:T.textDim}}>{pnl.totalJobs>0?Math.round(pnl.totalFeet/pnl.totalJobs):0} avg/job</div></Card>
 </div>

 {/* Tabs */}
 <div style={{display:"flex",gap:4,marginBottom:16}}>
 {[{k:"pnl",l:"P&L Detail"},{k:"customer",l:"By Customer"},{k:"region",l:"By Region"},{k:"crew",l:"Crew Productivity"},{k:"jobs",l:"Job Detail"}].map(t=>
 <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",borderRadius:4,border:`1px solid ${tab===t.k?T.accent:T.border}`,background:tab===t.k?T.accentSoft:"transparent",color:tab===t.k?T.accent:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{t.l}</button>)}
 </div>

 {/* P&L Detail */}
 {tab==="pnl"&&<Card style={{padding:0,overflow:"hidden"}}>
 <div style={{display:"flex",justifyContent:"flex-end",padding:"8px 12px",borderBottom:`1px solid ${T.border}`}}>
 <button onClick={exportPnl} style={{padding:"4px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>Export Excel</button>
 </div>
 {[
  {label:"Revenue",value:pnl.revenue,bold:true,color:T.success,indent:0},
  {label:"Labor Cost (Crew Payroll)",value:-pnl.laborCost,color:T.danger,indent:1},
  {label:`${companyConfig?.equipmentOwnerLabel||"Investor"} Commissions`,value:-pnl.investorCost,color:T.orange,indent:1},
  {label:"Material Cost",value:-pnl.materialCost,color:T.warning,indent:1},
  {label:"Gross Profit",value:pnl.grossProfit,bold:true,color:pnl.grossProfit>=0?T.success:T.danger,indent:0,border:true},
  {label:"Gross Margin",value:null,display:pnl.margin.toFixed(1)+"%",bold:true,color:pnl.grossProfit>=0?T.success:T.danger,indent:0},
 ].map((row,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${T.border}`,borderTop:row.border?`2px solid ${T.text}`:"none",paddingLeft:16+row.indent*20}}>
 <span style={{fontSize:13,fontWeight:row.bold?700:400,color:row.bold?T.text:T.textMuted}}>{row.label}</span>
 <span style={{fontSize:14,fontWeight:700,color:row.color,fontFamily:"monospace"}}>{row.display||$(row.value)}</span>
 </div>)}
 </Card>}

 {/* By Customer */}
 {tab==="customer"&&<Card style={{padding:0,overflow:"hidden"}}>
 <div style={{display:"flex",justifyContent:"flex-end",padding:"8px 12px",borderBottom:`1px solid ${T.border}`}}>
 <button onClick={exportCustomer} style={{padding:"4px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>Export Excel</button>
 </div>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
 <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgInput}}>
 {["Customer","Jobs","Footage","Revenue","$/ft","% of Total"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:h==="Customer"?"left":"right",fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase"}}>{h}</th>)}
 </tr></thead>
 <tbody>{Object.entries(pnl.byCustomer).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,d])=><tr key={name} style={{borderBottom:`1px solid ${T.border}`}}>
 <td style={{padding:"10px 14px",fontWeight:600,color:T.text}}>{name}</td>
 <td style={{padding:"10px 14px",textAlign:"right"}}>{d.jobs}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontFamily:"monospace"}}>{d.feet.toLocaleString()}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontWeight:700,color:T.success}}>{$(d.revenue)}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontFamily:"monospace"}}>${d.feet>0?(d.revenue/d.feet).toFixed(2):"0.00"}</td>
 <td style={{padding:"10px 14px",textAlign:"right",color:T.textMuted}}>{pnl.revenue>0?(d.revenue/pnl.revenue*100).toFixed(1):0}%</td>
 </tr>)}</tbody>
 </table>
 </Card>}

 {/* By Region */}
 {tab==="region"&&<Card style={{padding:0,overflow:"hidden"}}>
 <div style={{display:"flex",justifyContent:"flex-end",padding:"8px 12px",borderBottom:`1px solid ${T.border}`}}>
 <button onClick={exportRegion} style={{padding:"4px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>Export Excel</button>
 </div>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
 <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgInput}}>
 {["Region","Jobs","Footage","Revenue","% of Total"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:h==="Region"?"left":"right",fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase"}}>{h}</th>)}
 </tr></thead>
 <tbody>{Object.entries(pnl.byRegion).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,d])=><tr key={name} style={{borderBottom:`1px solid ${T.border}`}}>
 <td style={{padding:"10px 14px",fontWeight:600,color:T.text}}>{name}</td>
 <td style={{padding:"10px 14px",textAlign:"right"}}>{d.jobs}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontFamily:"monospace"}}>{d.feet.toLocaleString()}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontWeight:700,color:T.success}}>{$(d.revenue)}</td>
 <td style={{padding:"10px 14px",textAlign:"right",color:T.textMuted}}>{pnl.revenue>0?(d.revenue/pnl.revenue*100).toFixed(1):0}%</td>
 </tr>)}</tbody>
 </table>
 </Card>}

 {/* Crew Productivity */}
 {tab==="crew"&&<Card style={{padding:0,overflow:"hidden"}}>
 <div style={{display:"flex",justifyContent:"flex-end",padding:"8px 12px",borderBottom:`1px solid ${T.border}`}}>
 <button onClick={exportCrew} style={{padding:"4px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>Export Excel</button>
 </div>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
 <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgInput}}>
 {["Crew Member","Role","Jobs","Footage","Revenue","Avg Ft/Job","$/ft"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:["Crew Member","Role"].includes(h)?"left":"right",fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase"}}>{h}</th>)}
 </tr></thead>
 <tbody>{Object.entries(pnl.byCrew).sort((a,b)=>b[1].feet-a[1].feet).map(([name,d])=><tr key={name} style={{borderBottom:`1px solid ${T.border}`}}>
 <td style={{padding:"10px 14px",fontWeight:600,color:T.text}}>{name}</td>
 <td style={{padding:"10px 14px",color:T.textMuted,fontSize:11}}>{d.role==="lineman"?"Lineman":d.role==="foreman"?"Foreman":d.role||""}</td>
 <td style={{padding:"10px 14px",textAlign:"right"}}>{d.jobs}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{d.feet.toLocaleString()}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontWeight:700,color:T.success}}>{$(d.revenue)}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontFamily:"monospace"}}>{d.jobs>0?Math.round(d.feet/d.jobs).toLocaleString():0}</td>
 <td style={{padding:"10px 14px",textAlign:"right",fontFamily:"monospace"}}>${d.feet>0?(d.revenue/d.feet).toFixed(2):"0.00"}</td>
 </tr>)}</tbody>
 </table>
 </Card>}

 {/* Job Detail */}
 {tab==="jobs"&&<Card style={{padding:0,overflow:"hidden"}}>
 <div style={{display:"flex",justifyContent:"flex-end",padding:"8px 12px",borderBottom:`1px solid ${T.border}`}}>
 <button onClick={exportJobDetail} style={{padding:"4px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>Export Excel</button>
 </div>
 <div style={{overflowX:"auto"}}>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:900}}>
 <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgInput}}>
 {["Feeder","Customer","Region","Dept","Crew","Equipment","Footage","Revenue","Labor","Status"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:["Footage","Revenue","Labor"].includes(h)?"right":"left",fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}
 </tr></thead>
 <tbody>{periodJobs.sort((a,b)=>(b.production?.totalFeet||0)-(a.production?.totalFeet||0)).slice(0,100).map(j=>{
  const c=calcJob(j,rateCards);const t=c.totals||{};
  const crew=j.assignedLineman?USERS.find(u=>u.id===j.assignedLineman):null;
  return <tr key={j.id} style={{borderBottom:`1px solid ${T.border}`}}>
  <td style={{padding:"8px 10px",fontWeight:600,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</td>
  <td style={{padding:"8px 10px",color:T.text}}>{j.customer}</td>
  <td style={{padding:"8px 10px",color:T.textMuted}}>{j.region}</td>
  <td style={{padding:"8px 10px"}}><Badge label={j.department==="aerial"?"A":"UG"} color={j.department==="aerial"?T.accent:T.cyan} bg={(j.department==="aerial"?T.accent:T.cyan)+"18"}/></td>
  <td style={{padding:"8px 10px",color:T.text,fontSize:11}}>{crew?.name||"—"}</td>
  <td style={{padding:"8px 10px",color:T.textMuted,fontFamily:"monospace",fontSize:10}}>{j.assignedTruck||j.assignedDrill||"—"}</td>
  <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600,fontFamily:"monospace"}}>{(j.production?.totalFeet||0).toLocaleString()}</td>
  <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:T.success}}>{$(t.nextgenRevenue||0)}</td>
  <td style={{padding:"8px 10px",textAlign:"right",color:T.danger}}>{$(t.linemanPay||0)}</td>
  <td style={{padding:"8px 10px"}}><Badge label={j.status} color={STATUS_CFG[j.status]?.c||T.textMuted} bg={STATUS_CFG[j.status]?.bg||T.bgInput}/></td>
  </tr>;})}</tbody>
 </table>
 </div>
 {periodJobs.length>100&&<div style={{padding:10,textAlign:"center",fontSize:11,color:T.textMuted}}>Showing first 100 of {periodJobs.length} jobs. Export Excel for full data.</div>}
 </Card>}
 </div>;
}

// ─── INVOICING & ACCOUNTS RECEIVABLE ────────────────────────────────────────
function InvoicingView(){
 const{jobs,setJobs,rateCards,invoices,setInvoices,companyConfig}=useApp();
 const[tab,setTab]=useState("ready");
 const[selInv,setSelInv]=useState(null);
 const[showCreate,setShowCreate]=useState(false);
 const[selJobs,setSelJobs]=useState({});
 const[invNotes,setInvNotes]=useState("");
 const[invTerms,setInvTerms]=useState("Net 30");
 const[invBillTo,setInvBillTo]=useState("");

 // Jobs ready to invoice = "Ready to Invoice" status, not on an invoice, and client requires invoicing
 const invoicedJobIds=new Set(invoices.flatMap(inv=>inv.jobIds));
 const cb=companyConfig?.clientBilling||{};
 const isPortalJob=(j)=>(cb[j.client]?.type==="portal")||(cb[j.customer]?.type==="portal");
 const readyJobs=jobs.filter(j=>j.status==="Ready to Invoice"&&!invoicedJobIds.has(j.id)&&!isPortalJob(j));
 const portalJobs=jobs.filter(j=>j.status==="Ready to Invoice"&&isPortalJob(j));
 const billedJobs=jobs.filter(j=>j.status==="Billed");

 // Group ready jobs by client|customer
 const readyGroups=useMemo(()=>{
  const g={};readyJobs.forEach(j=>{
   const k=`${j.client} — ${j.customer}`;
   if(!g[k])g[k]={client:j.client,customer:j.customer,jobs:[]};
   g[k].jobs.push(j);
  });return g;
 },[readyJobs]);

 const createInvoice=()=>{
  const jobIds=Object.keys(selJobs).filter(k=>selJobs[k]);
  if(jobIds.length===0)return;
  const invJobs=jobs.filter(j=>jobIds.includes(j.id));
  const client=invJobs[0]?.client;const customer=invJobs[0]?.customer;
  // Calculate totals
  let totalAmount=0;const lineItems=[];
  invJobs.forEach(j=>{
   const calc=calcJob(j,rateCards);
   if(calc.status==="Calculated"&&calc.totals){
    totalAmount+=calc.totals.nextgenRevenue;
    calc.items.forEach(item=>{
     lineItems.push({jobId:j.id,feederId:j.feederId,code:item.code,description:item.description,qty:item.qty,unit:item.unit,rate:item.nextgenRate,amount:item.nextgenAmount});
    });
   }
  });
  const inv={
   id:`INV-${String(invoices.length+1001).padStart(4,"0")}`,
   createdAt:new Date().toISOString(),
   client,customer,region:invJobs[0]?.region,
   jobIds,jobCount:jobIds.length,
   lineItems,totalAmount:+totalAmount.toFixed(2),
   terms:invTerms,billTo:invBillTo||`${customer} c/o ${client}`,
   notes:invNotes,
   status:"draft", // draft → sent → paid → void
   sentAt:null,paidAt:null,paidAmount:null,paymentRef:null,
   from:companyConfig?.companyName||"NextGen Fiber",
  };
  setInvoices(prev=>[...prev,inv]);
  // Mark jobs as Billed
  setJobs(prev=>prev.map(j=>jobIds.includes(j.id)?{...j,status:"Billed",billedAt:new Date().toISOString()}:j));
  setShowCreate(false);setSelJobs({});setInvNotes("");setInvBillTo("");
  setSelInv(inv.id);setTab("all");
 };

 const updateInvStatus=(invId,status,extra={})=>{
  setInvoices(prev=>prev.map(inv=>inv.id===invId?{...inv,status,...extra}:inv));
 };

 const allInvoices=invoices.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const draftInvs=allInvoices.filter(i=>i.status==="draft");
 const sentInvs=allInvoices.filter(i=>i.status==="sent");
 const paidInvs=allInvoices.filter(i=>i.status==="paid");
 const totalOutstanding=sentInvs.reduce((s,i)=>s+i.totalAmount,0);
 const totalPaid=paidInvs.reduce((s,i)=>s+(i.paidAmount||i.totalAmount),0);
 const totalDraft=draftInvs.reduce((s,i)=>s+i.totalAmount,0);

 // Detail view
 if(selInv){
  const inv=invoices.find(i=>i.id===selInv);
  if(!inv)return <div><Btn v="ghost" onClick={()=>setSelInv(null)}>← Back</Btn></div>;
  const stColor=inv.status==="paid"?T.success:inv.status==="sent"?T.warning:inv.status==="void"?T.danger:T.textMuted;
  return <div>
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
  <Btn v="ghost" sz="sm" onClick={()=>setSelInv(null)}>← Back</Btn>
  <div style={{flex:1}}>
  <h2 style={{fontSize:20,fontWeight:700,color:T.text,margin:0}}>{inv.id}</h2>
  <span style={{fontSize:12,color:T.textMuted}}>{inv.customer} · {inv.client} · Created {fd(inv.createdAt)}</span>
  </div>
  <Badge label={inv.status.toUpperCase()} color={stColor} bg={stColor+"18"}/>
  </div>

  {/* Invoice header card */}
  <Card style={{marginBottom:16,padding:20}}>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
  <div>
  <div style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.4}}>From</div>
  <div style={{fontSize:14,fontWeight:700,color:T.text,marginTop:4}}>{inv.from}</div>
  </div>
  <div>
  <div style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.4}}>Bill To</div>
  <div style={{fontSize:14,fontWeight:700,color:T.text,marginTop:4}}>{inv.billTo}</div>
  </div>
  <div>
  <div style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.4}}>Terms</div>
  <div style={{fontSize:13,color:T.text,marginTop:4}}>{inv.terms}</div>
  </div>
  <div>
  <div style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.4}}>Jobs Included</div>
  <div style={{fontSize:13,color:T.text,marginTop:4}}>{inv.jobCount} jobs · {inv.region}</div>
  </div>
  </div>
  {inv.notes&&<div style={{marginTop:12,padding:10,background:T.bgInput,borderRadius:4,fontSize:12,color:T.textMuted}}>{inv.notes}</div>}
  </Card>

  {/* Line items */}
  <Card style={{marginBottom:16,padding:0,overflow:"hidden"}}>
  <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase"}}>Line Items</div>
  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
  <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgInput}}>
  {["Job/Feeder","Code","Description","Qty","Unit","Rate","Amount"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase"}}>{h}</th>)}
  </tr></thead>
  <tbody>{inv.lineItems.map((li,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
  <td style={{padding:"8px 12px",fontWeight:600,color:T.accent,fontFamily:"monospace",fontSize:11}}>{li.feederId}</td>
  <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11}}>{li.code}</td>
  <td style={{padding:"8px 12px",color:T.textMuted}}>{li.description}</td>
  <td style={{padding:"8px 12px",textAlign:"right",fontWeight:600}}>{li.qty?.toLocaleString()}</td>
  <td style={{padding:"8px 12px",color:T.textDim,fontSize:11}}>{li.unit}</td>
  <td style={{padding:"8px 12px",textAlign:"right"}}>{li.rate!=null?`$${li.rate.toFixed(2)}`:""}</td>
  <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:T.success}}>{li.amount!=null?$(li.amount):""}</td>
  </tr>)}</tbody>
  <tfoot><tr style={{background:T.bgInput}}>
  <td colSpan={6} style={{padding:"12px 16px",textAlign:"right",fontSize:14,fontWeight:700,color:T.text}}>TOTAL</td>
  <td style={{padding:"12px 16px",textAlign:"right",fontSize:16,fontWeight:700,color:T.success}}>{$(inv.totalAmount)}</td>
  </tr></tfoot>
  </table>
  </Card>

  {/* Actions */}
  <Card style={{padding:16}}>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
  {inv.status==="draft"&&<>
  <Btn v="success" onClick={()=>updateInvStatus(inv.id,"sent",{sentAt:new Date().toISOString()})}>Mark as Sent</Btn>
  <Btn v="danger" onClick={()=>{if(confirm("Void this invoice?"))updateInvStatus(inv.id,"void");}}>Void</Btn>
  </>}
  {inv.status==="sent"&&<>
  <Btn v="success" onClick={()=>{const ref=prompt("Payment reference (check #, ACH, wire, Thalia, etc.):");if(ref)updateInvStatus(inv.id,"paid",{paidAt:new Date().toISOString(),paidAmount:inv.totalAmount,paymentRef:ref});}}>Record Payment</Btn>
  <Btn v="ghost" onClick={()=>updateInvStatus(inv.id,"draft",{sentAt:null})}>Back to Draft</Btn>
  </>}
  {inv.status==="paid"&&<div style={{fontSize:13,color:T.success,fontWeight:600}}>Paid on {fd(inv.paidAt)} · Ref: {inv.paymentRef}</div>}
  <Btn v="ghost" onClick={()=>{
   // Generate printable invoice HTML
   const rows=inv.lineItems.map(li=>`<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px">${li.feederId||""}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px">${li.code||""}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#666;font-size:12px">${li.description||""}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${li.qty!=null?li.qty.toLocaleString():""}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#999;font-size:11px">${li.unit||""}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${li.rate!=null?"$"+li.rate.toFixed(2):""}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">$${(li.amount||0).toFixed(2)}</td>
   </tr>`).join("");
   const terms=inv.terms||"Net 30";
   const dueDate=inv.sentAt?new Date(new Date(inv.sentAt).getTime()+parseInt(terms.replace(/\D/g,"")|| "30")*86400000).toLocaleDateString():"-";
   const html=`<!DOCTYPE html><html><head><title>${inv.id} — Invoice</title>
   <style>@media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
   body{font-family:-apple-system,system-ui,sans-serif;color:#111;max-width:800px;margin:0 auto;padding:40px}
   table{width:100%;border-collapse:collapse}
   .header{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #111}
   .inv-title{font-size:28px;font-weight:800;letter-spacing:1px}
   .meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
   .meta-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:4px}
   .meta-value{font-size:14px;font-weight:600}
   .total-row{background:#f8f9fa;font-size:16px;font-weight:800}
   .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#888}
   </style></head><body>
   <div class="header">
    <div><div class="inv-title">INVOICE</div><div style="font-size:13px;color:#666;margin-top:4px">${inv.id}</div></div>
    <div style="text-align:right"><div style="font-size:18px;font-weight:700">${inv.from||"NextGen Fiber"}</div></div>
   </div>
   <div class="meta">
    <div><div class="meta-label">Bill To</div><div class="meta-value">${inv.billTo||""}</div></div>
    <div><div class="meta-label">Invoice Date</div><div class="meta-value">${new Date(inv.createdAt).toLocaleDateString()}</div></div>
    <div><div class="meta-label">Terms</div><div class="meta-value">${terms}</div></div>
    <div><div class="meta-label">Due Date</div><div class="meta-value">${dueDate}</div></div>
    <div><div class="meta-label">Region</div><div class="meta-value">${inv.region||""}</div></div>
    <div><div class="meta-label">Jobs Included</div><div class="meta-value">${inv.jobCount}</div></div>
   </div>
   <table>
    <thead><tr style="border-bottom:2px solid #111">
     <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Job</th>
     <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Code</th>
     <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Description</th>
     <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Qty</th>
     <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Unit</th>
     <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Rate</th>
     <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row">
     <td colspan="6" style="padding:12px 10px;text-align:right;font-size:14px">TOTAL DUE</td>
     <td style="padding:12px 10px;text-align:right;font-size:18px">$${inv.totalAmount.toFixed(2)}</td>
    </tr></tfoot>
   </table>
   ${inv.notes?`<div style="margin-top:20px;padding:12px;background:#f8f9fa;border-radius:4px;font-size:12px;color:#666">${inv.notes}</div>`:""}
   <div class="footer">
    <div>Generated by ${inv.from||"NextGen Fiber"} via Fiberlytic · ${new Date().toLocaleDateString()}</div>
   </div>
   </body></html>`;
   const w=window.open("","_blank","width=850,height=1100");
   w.document.write(html);w.document.close();
   setTimeout(()=>w.print(),500);
  }}>Export PDF</Btn>
  </div>
  {inv.sentAt&&inv.status!=="paid"&&<div style={{marginTop:8,fontSize:11,color:T.textMuted}}>Sent on {fd(inv.sentAt)} · {Math.floor((Date.now()-new Date(inv.sentAt).getTime())/86400000)} days ago</div>}
  </Card>
  </div>;
 }

 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
 <div><h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Invoicing & Billing</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>Create invoices from approved jobs, track payments and receivables</p></div>
 <Btn onClick={()=>setShowCreate(true)} disabled={readyJobs.length===0}>+ Create Invoice</Btn>
 </div>

 {/* Summary cards */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Ready to Invoice</div><div style={{fontSize:26,fontWeight:600,color:T.warning,marginTop:4}}>{readyJobs.length} jobs</div><div style={{fontSize:11,color:T.textDim}}>awaiting invoice creation</div></Card>
 <Card style={{padding:16}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Drafts</div><div style={{fontSize:26,fontWeight:600,color:T.textMuted,marginTop:4}}>{$(totalDraft)}</div><div style={{fontSize:11,color:T.textDim}}>{draftInvs.length} invoice{draftInvs.length!==1?"s":""}</div></Card>
 <Card style={{padding:16,borderLeft:`3px solid ${T.warning}`}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Outstanding</div><div style={{fontSize:26,fontWeight:600,color:T.warning,marginTop:4}}>{$(totalOutstanding)}</div><div style={{fontSize:11,color:T.textDim}}>{sentInvs.length} sent, awaiting payment</div></Card>
 <Card style={{padding:16,borderLeft:`3px solid ${T.success}`}}><div style={{fontSize:11,color:T.textMuted,fontWeight:500,textTransform:"uppercase"}}>Collected</div><div style={{fontSize:26,fontWeight:600,color:T.success,marginTop:4}}>{$(totalPaid)}</div><div style={{fontSize:11,color:T.textDim}}>{paidInvs.length} paid</div></Card>
 </div>

 {/* Tabs */}
 <div style={{display:"flex",gap:4,marginBottom:16}}>
 {[{k:"ready",l:`Ready to Invoice (${readyJobs.length})`},{k:"all",l:`All Invoices (${allInvoices.length})`},{k:"outstanding",l:`Outstanding (${sentInvs.length})`},{k:"paid",l:`Paid (${paidInvs.length})`}].map(t=>
 <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",borderRadius:4,border:`1px solid ${tab===t.k?T.accent:T.border}`,background:tab===t.k?T.accentSoft:"transparent",color:tab===t.k?T.accent:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{t.l}</button>)}
 </div>

 {/* Ready to Invoice tab */}
 {tab==="ready"&&<div>
 {readyJobs.length===0?<Card style={{padding:32,textAlign:"center"}}><div style={{fontSize:13,color:T.textMuted}}>No jobs ready to invoice. Jobs move here after client approval.</div></Card>
 :Object.entries(readyGroups).map(([groupKey,group])=><Card key={groupKey} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
 <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bgInput}}>
 <div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{group.customer}</div><div style={{fontSize:11,color:T.textMuted}}>{group.client} · {group.jobs.length} jobs</div></div>
 <Btn sz="sm" onClick={()=>{const sel={};group.jobs.forEach(j=>{sel[j.id]=true;});setSelJobs(sel);setInvBillTo(`${group.customer} c/o ${group.client}`);setShowCreate(true);}}>Invoice All ({group.jobs.length})</Btn>
 </div>
 {group.jobs.map(j=>{const calc=calcJob(j,rateCards);const rev=calc.totals?.nextgenRevenue||0;
 return <div key={j.id} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <input type="checkbox" checked={!!selJobs[j.id]} onChange={()=>setSelJobs(p=>({...p,[j.id]:!p[j.id]}))} style={{cursor:"pointer"}}/>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{j.location} · SR# {j.srNumber} · {j.production?.totalFeet?.toLocaleString()||0} ft</div>
 </div>
 </div>
 <div style={{fontSize:13,fontWeight:700,color:T.success}}>{$(rev)}</div>
 </div>;})}
 </Card>)}
 {Object.keys(selJobs).some(k=>selJobs[k])&&<div style={{position:"sticky",bottom:0,padding:12,background:T.bgCard,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:4,marginTop:8}}>
 <span style={{fontSize:13,color:T.text,fontWeight:600}}>{Object.values(selJobs).filter(Boolean).length} jobs selected</span>
 <Btn onClick={()=>setShowCreate(true)}>Create Invoice from Selected</Btn>
 </div>}
 {portalJobs.length>0&&<Card style={{marginTop:16,padding:16,borderLeft:`3px solid ${T.success}`}}>
 <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:4}}>Direct Portal Clients — No Invoice Needed</div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:10}}>These {portalJobs.length} jobs are with clients that handle billing through their own portal. Submit redlines directly in their system.</div>
 {(()=>{const groups={};portalJobs.forEach(j=>{const k=j.client;if(!groups[k])groups[k]={jobs:[],note:cb[k]?.note||cb[j.customer]?.note||""};groups[k].jobs.push(j);});
 return Object.entries(groups).map(([client,g])=>{
  let total=0;g.jobs.forEach(j=>{const c=calcJob(j,rateCards);if(c.totals)total+=c.totals.nextgenRevenue;});
  return <div key={client} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
  <div><span style={{fontSize:13,fontWeight:600,color:T.text}}>{client}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{g.jobs.length} jobs · {g.note}</span></div>
  <span style={{fontSize:13,fontWeight:700,color:T.success}}>{$(total)}</span>
  </div>;
 });})()}
 </Card>}
 </div>}

 {/* Invoice list tabs */}
 {["all","outstanding","paid"].includes(tab)&&<Card style={{padding:0,overflow:"hidden"}}>
 {(tab==="all"?allInvoices:tab==="outstanding"?sentInvs:paidInvs).length===0?<div style={{padding:32,textAlign:"center",color:T.textMuted,fontSize:13}}>No invoices{tab==="outstanding"?" outstanding":tab==="paid"?" paid yet":""}.</div>
 :(tab==="all"?allInvoices:tab==="outstanding"?sentInvs:paidInvs).map(inv=>{
 const stColor=inv.status==="paid"?T.success:inv.status==="sent"?T.warning:inv.status==="void"?T.danger:T.textMuted;
 const daysSent=inv.sentAt?Math.floor((Date.now()-new Date(inv.sentAt).getTime())/86400000):null;
 return <div key={inv.id} onClick={()=>setSelInv(inv.id)} className="card-hover" style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",transition:"background 0.1s"}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <div style={{width:8,height:8,borderRadius:"50%",background:stColor}}/>
 <div>
 <div style={{fontSize:13,fontWeight:600,color:T.text}}>{inv.id} · {inv.customer}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{inv.jobCount} jobs · {inv.client} · {fd(inv.createdAt)}{daysSent!=null&&inv.status==="sent"?` · ${daysSent}d outstanding`:""}</div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <div style={{fontSize:14,fontWeight:700,color:inv.status==="paid"?T.success:T.text}}>{$(inv.totalAmount)}</div>
 <Badge label={inv.status.toUpperCase()} color={stColor} bg={stColor+"18"}/>
 </div>
 </div>;})}
 </Card>}

 {/* Create invoice modal */}
 <Modal open={showCreate} onClose={()=>{setShowCreate(false);setSelJobs({});}} title="Create Invoice" width={560}>
 <div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>{Object.values(selJobs).filter(Boolean).length} jobs selected</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
 <Inp label="Bill To" value={invBillTo} onChange={setInvBillTo} ph="e.g. Brightspeed c/o MasTec"/>
 <Inp label="Payment Terms" value={invTerms} onChange={setInvTerms} options={["Net 15","Net 30","Net 45","Net 60","Due on Receipt"]}/>
 </div>
 <Inp label="Notes / Memo" value={invNotes} onChange={setInvNotes} textarea ph="Optional — PO reference, special instructions, etc."/>
 {/* Preview totals */}
 {(()=>{let total=0;const selIds=Object.keys(selJobs).filter(k=>selJobs[k]);
 selIds.forEach(id=>{const j=jobs.find(x=>x.id===id);if(j){const c=calcJob(j,rateCards);if(c.totals)total+=c.totals.nextgenRevenue;}});
 return <div style={{padding:12,background:T.bgInput,borderRadius:4,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <span style={{fontSize:13,color:T.textMuted}}>{selIds.length} jobs</span>
 <span style={{fontSize:18,fontWeight:700,color:T.success}}>{$(total)}</span>
 </div>;})()}
 <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="ghost" onClick={()=>{setShowCreate(false);setSelJobs({});}}>Cancel</Btn><Btn onClick={createInvoice} disabled={Object.values(selJobs).filter(Boolean).length===0}>Create Invoice</Btn></div>
 </div>
 </Modal>
 </div>;
}

// ─── COMPANY SETTINGS ───────────────────────────────────────────────────────
function SettingsView(){
 const{companyConfig,setCompanyConfig}=useApp();
 const cc=companyConfig;
 const[newTruckCat,setNewTruckCat]=useState("");
 const[newDrillCat,setNewDrillCat]=useState("");

 const togDept=(d)=>{
  const deps=cc.departments.includes(d)?cc.departments.filter(x=>x!==d):[...cc.departments,d];
  if(deps.length===0)return;
  setCompanyConfig({...cc,departments:deps});
 };

 const addTruckMaint=()=>{if(!newTruckCat.trim()||cc.truckMaintenance.includes(newTruckCat.trim()))return;setCompanyConfig({...cc,truckMaintenance:[...cc.truckMaintenance,newTruckCat.trim()]});setNewTruckCat("");};
 const removeTruckMaint=(cat)=>setCompanyConfig({...cc,truckMaintenance:cc.truckMaintenance.filter(c=>c!==cat)});
 const addDrillMaint=()=>{if(!newDrillCat.trim()||cc.drillMaintenance.includes(newDrillCat.trim()))return;setCompanyConfig({...cc,drillMaintenance:[...cc.drillMaintenance,newDrillCat.trim()]});setNewDrillCat("");};
 const removeDrillMaint=(cat)=>setCompanyConfig({...cc,drillMaintenance:cc.drillMaintenance.filter(c=>c!==cat)});

 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>Company Settings</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 20px"}}>Configure your operation type, equipment, and terminology</p>

 {/* Company name */}
 <Card style={{marginBottom:16,padding:20}}>
 <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Company Info</div>
 <Inp label="Company Name" value={cc.companyName} onChange={v=>setCompanyConfig({...cc,companyName:v})}/>
 </Card>

 {/* Active departments */}
 <Card style={{marginBottom:16,padding:20}}>
 <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Active Departments</div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>Which types of work does your company perform? This controls which sections appear in navigation.</div>
 <div style={{display:"flex",gap:10}}>
 {[{k:"aerial",l:"Aerial Construction",desc:"Strand, overlash, fiber, pole work — requires bucket trucks and linemen"},{k:"underground",l:"Underground / Boring",desc:"Directional boring, conduit, underground fiber — requires drills and foremen"}].map(d=>{
  const active=cc.departments.includes(d.k);
  return <div key={d.k} onClick={()=>togDept(d.k)} style={{flex:1,padding:16,borderRadius:6,border:`2px solid ${active?T.accent:T.border}`,background:active?T.accentSoft:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
  <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${active?T.accent:T.border}`,background:active?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700}}>{active?"✓":""}</div>
  <div style={{fontSize:14,fontWeight:600,color:active?T.text:T.textMuted}}>{d.l}</div>
  </div>
  <div style={{fontSize:11,color:T.textDim}}>{d.desc}</div>
  </div>;
 })}
 </div>
 </Card>

 {/* Equipment owners */}
 <Card style={{marginBottom:16,padding:20}}>
 <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Equipment Ownership Model</div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>Do external parties own equipment that your company operates? Enable this if you have investors, partners, or lessors who provide trucks/drills and receive commission or rental payments.</div>
 <div style={{display:"flex",gap:10,marginBottom:12}}>
 {[{v:true,l:"Yes — external equipment owners",desc:"Track ownership, commissions/returns per owner. Owners get their own portal."},{v:false,l:"No — all company-owned",desc:"All equipment owned by the company. No owner portal or commission tracking."}].map(o=>{
  const active=cc.hasEquipmentOwners===o.v;
  return <div key={String(o.v)} onClick={()=>setCompanyConfig({...cc,hasEquipmentOwners:o.v})} style={{flex:1,padding:14,borderRadius:6,border:`2px solid ${active?T.accent:T.border}`,background:active?T.accentSoft:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
  <div style={{fontSize:13,fontWeight:600,color:active?T.text:T.textMuted,marginBottom:4}}>{o.l}</div>
  <div style={{fontSize:11,color:T.textDim}}>{o.desc}</div>
  </div>;
 })}
 </div>
 {cc.hasEquipmentOwners&&<Inp label="What do you call equipment owners?" value={cc.equipmentOwnerLabel} onChange={v=>setCompanyConfig({...cc,equipmentOwnerLabel:v})} options={["Investor","Owner","Partner","Lessor"]}/>}
 </Card>

 {/* Truck maintenance categories */}
 {cc.departments.includes("aerial")&&<Card style={{marginBottom:16,padding:20}}>
 <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Truck Maintenance Categories</div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>What compliance and maintenance items do you track for your aerial trucks?</div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
 {cc.truckMaintenance.map(cat=><div key={cat} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`}}>
 <span style={{fontSize:12,color:T.text}}>{cat}</span>
 <button onClick={()=>removeTruckMaint(cat)} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>✕</button>
 </div>)}
 </div>
 <div style={{display:"flex",gap:8}}>
 <input value={newTruckCat} onChange={e=>setNewTruckCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTruckMaint()} placeholder="e.g. Brake Inspection, Lift Certification..." style={{flex:1,padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/>
 <Btn sz="sm" onClick={addTruckMaint} disabled={!newTruckCat.trim()}>Add</Btn>
 </div>
 </Card>}

 {/* Drill maintenance categories */}
 {cc.departments.includes("underground")&&<Card style={{marginBottom:16,padding:20}}>
 <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Drill / Boring Equipment Maintenance Categories</div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>What compliance and maintenance items do you track for your drilling equipment?</div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
 {cc.drillMaintenance.map(cat=><div key={cat} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`}}>
 <span style={{fontSize:12,color:T.text}}>{cat}</span>
 <button onClick={()=>removeDrillMaint(cat)} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>✕</button>
 </div>)}
 </div>
 <div style={{display:"flex",gap:8}}>
 <input value={newDrillCat} onChange={e=>setNewDrillCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addDrillMaint()} placeholder="e.g. Track Tension, Fluid Analysis, Locator Calibration..." style={{flex:1,padding:"8px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/>
 <Btn sz="sm" onClick={addDrillMaint} disabled={!newDrillCat.trim()}>Add</Btn>
 </div>
 </Card>}

 {/* Client billing type */}
 <Card style={{marginBottom:16,padding:20}}>
 <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Client Billing Configuration</div>
 <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>How does each client handle billing? "Direct Portal" clients (like MasTec/Oracle) don't need you to create invoices — you submit production directly in their system. "Invoice Required" clients need you to generate and send invoices from Fiberlytic.</div>
 {CLIENTS.map(client=>{
  const cfg=cc.clientBilling?.[client]||{type:"invoice"};
  const isPortal=cfg.type==="portal";
  return <div key={client} style={{padding:12,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
  <div>
  <div style={{fontSize:14,fontWeight:600,color:T.text}}>{client}</div>
  {isPortal&&cfg.note&&<div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{cfg.note}</div>}
  </div>
  <div style={{display:"flex",gap:6}}>
  {[{v:"invoice",l:"Invoice Required"},{v:"portal",l:"Direct Portal"}].map(o=><button key={o.v} onClick={()=>{
   const nb={...cc.clientBilling};
   if(o.v==="portal"){nb[client]={type:"portal",note:nb[client]?.note||"Submit in client portal"};} else {delete nb[client];}
   setCompanyConfig({...cc,clientBilling:nb});
  }} style={{padding:"5px 12px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",border:`1.5px solid ${cfg.type===o.v?T.accent:T.border}`,background:cfg.type===o.v?T.accentSoft:"transparent",color:cfg.type===o.v?T.accent:T.textMuted,transition:"all 0.15s"}}>{o.l}</button>)}
  </div>
  </div>;
 })}
 {CUSTOMERS.map(cust=>{
  const cfg=cc.clientBilling?.[cust]||{type:"invoice"};
  const isPortal=cfg.type==="portal";
  return <div key={cust} style={{padding:12,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
  <div>
  <div style={{fontSize:14,fontWeight:600,color:T.text}}>{cust}<span style={{fontSize:11,color:T.textDim,marginLeft:6}}>Customer</span></div>
  {isPortal&&<input value={cfg.note||""} onChange={e=>{const nb={...cc.clientBilling};nb[cust]={...nb[cust],note:e.target.value};setCompanyConfig({...cc,clientBilling:nb});}} placeholder="Portal details..." style={{marginTop:4,padding:"3px 6px",fontSize:11,border:`1px solid ${T.border}`,borderRadius:3,background:T.bgInput,color:T.text,width:250,boxSizing:"border-box"}}/>}
  </div>
  <div style={{display:"flex",gap:6}}>
  {[{v:"invoice",l:"Invoice Required"},{v:"portal",l:"Direct Portal"}].map(o=><button key={o.v} onClick={()=>{
   const nb={...cc.clientBilling};
   if(o.v==="portal"){nb[cust]={type:"portal",note:nb[cust]?.note||"Submit in client portal"};} else {delete nb[cust];}
   setCompanyConfig({...cc,clientBilling:nb});
  }} style={{padding:"5px 12px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",border:`1.5px solid ${cfg.type===o.v?T.accent:T.border}`,background:cfg.type===o.v?T.accentSoft:"transparent",color:cfg.type===o.v?T.accent:T.textMuted,transition:"all 0.15s"}}>{o.l}</button>)}
  </div>
  </div>;
 })}
 </Card>
 </div>;
}

export default function App(){
 const[jobs,setJobs]=useState(genJobs);
 const[rateCards,setRateCards]=useState(genRateCards);
 const[trucks,setTrucks]=useState([...TRUCKS]);
 const[drills,setDrills]=useState([...DRILLS]);
 const[currentUser,setCU]=useState(USERS[0]);
 const[view,setView]=useState("dashboard");
 const[selectedJob,setSelectedJob]=useState(null);
 const[navFrom,setNavFrom]=useState(null);
 const[jobsPreFilter,setJobsPreFilter]=useState("");
 const[dark,setDark]=useState(false);
 const[sidebarOpen,setSidebarOpen]=useState(false);
 const[paidStubs,setPaidStubs]=useState({});
 const[payrollRuns,setPayrollRuns]=useState({});
 // Company config — what does this sub actually operate?
 const[companyConfig,setCompanyConfig]=useState({
  departments:["aerial","underground"], // which departments are active
  hasEquipmentOwners:true, // do they have external equipment owners (investors)?
  equipmentOwnerLabel:"Investor", // what to call them — "Investor", "Owner", "Lessor", "Partner"
  companyName:"NextGen Fiber",
  // custom maintenance categories per equipment type
  truckMaintenance:["DOT Inspection","Insurance","Registration","Oil Change","Tire Inspection"],
  drillMaintenance:["Service","Hydraulic Inspection","Bit Replacement"],
  clientBilling:{"MasTec":{type:"portal",note:"Submit redlines in Oracle. Payment via Thalia."}},
 });
 const[bankAccounts,setBankAccounts]=useState(()=>{
 // Seed some users with bank info for demo
 const ba={};
 USERS.filter(u=>["lineman","foreman","supervisor"].includes(u.role)).forEach(u=>{
 ba[u.id]={bank:"Chase",routingLast4:"6789",accountLast4:String(1000+Math.floor(Math.random()*9000)).slice(-4),accountType:"checking",verified:true,addedAt:"2025-01-20T10:00:00Z"};
 });
 // Investors too
 USERS.filter(u=>u.role==="truck_investor"||u.role==="drill_investor").forEach(u=>{
 ba[u.id]={bank:"Wells Fargo",routingLast4:"4321",accountLast4:String(1000+Math.floor(Math.random()*9000)).slice(-4),accountType:"checking",verified:true,addedAt:"2025-02-10T10:00:00Z"};
 });
 return ba;
 });
 T=dark?DARK:LIGHT;
 const[pickups,setPickups]=useState(genPickups);
 const[materialMode,setMaterialMode]=useState("client");
 const[invoices,setInvoices]=useState([]);
 const[tickets,setTickets]=useState([
 {id:'TK-0001',subject:'TRK-102 broke down — crew delayed',region:'Alabama',customer:'Brightspeed',priority:'high',status:'Acknowledged',createdBy:'Admin User',createdByRole:'admin',createdAt:'2026-02-12T15:12:00Z',relatedJob:'BSPD001.04H',assignedTo:'u1',messages:[
 {id:'tm1a',from:'Admin User',role:'admin',text:'TRK-102 broke down around 3pm near Falkville. Crew could not finish BSPD001.04H. Getting it to the shop — will reassign TRK-105 if needed. Update by 6pm.',ts:'2026-02-12T15:12:00Z'},
 {id:'tm1b',from:'Jean-Luc Beer',role:'client_manager',text:'Thanks for the heads up. How much was left?',ts:'2026-02-12T15:28:00Z'},
 {id:'tm1c',from:'Admin User',role:'admin',text:'About 1,200 ft. Matheus will be first on it tomorrow.',ts:'2026-02-12T15:35:00Z'},
 {id:'tm1d',from:'Jean-Luc Beer',role:'client_manager',text:'Acknowledged — keep me posted. Done by Friday is fine.',ts:'2026-02-12T15:42:00Z'}]},
 {id:'TK-0002',subject:'Permitting hold — BSPD002.03B',region:'Alabama',customer:'Brightspeed',priority:'urgent',status:'Open',createdBy:'Admin User',createdByRole:'admin',createdAt:'2026-02-12T10:30:00Z',relatedJob:'BSPD002.03B',assignedTo:'u1',messages:[
 {id:'tm2a',from:'Admin User',role:'admin',text:'County inspector stopped crew on BSPD002.03B — permit not renewed. Crew pulled off. Can your permitting team check?',ts:'2026-02-12T10:30:00Z'}]},
 {id:'TK-0003',subject:'Weather delay — NC crews stood down',region:'North Carolina',customer:'Brightspeed',priority:'normal',status:'Resolved',createdBy:'Sam Domaleski',createdByRole:'supervisor',createdAt:'2026-02-11T07:45:00Z',relatedJob:null,assignedTo:'u2',messages:[
 {id:'tm3a',from:'Sam Domaleski',role:'supervisor',text:'Ice storm warning. All crews standing down today.',ts:'2026-02-11T07:45:00Z'},
 {id:'tm3b',from:'Jean-Luc Beer',role:'client_manager',text:'Safety first. Keep me posted.',ts:'2026-02-11T08:10:00Z'},
 {id:'tm3c',from:'Sam Domaleski',role:'supervisor',text:'Roads clear. All crews back out.',ts:'2026-02-12T07:30:00Z'},
 {id:'tm3d',from:'Jean-Luc Beer',role:'client_manager',text:'Resolved. Thanks.',ts:'2026-02-12T08:00:00Z'}]},
 {id:'TK-0004',subject:'Pole #4412 rotted — replacement needed',region:'Alabama',customer:'Brightspeed',priority:'high',status:'Open',createdBy:'Sam Domaleski',createdByRole:'supervisor',createdAt:'2026-02-10T14:20:00Z',relatedJob:'BSPD001.01G',assignedTo:'u2',messages:[
 {id:'tm4a',from:'Sam Domaleski',role:'supervisor',text:'Near-miss on pole #4412 — rotted at base. Donaldo safe. Flagged pole and 3 adjacent.',ts:'2026-02-10T14:20:00Z'},
 {id:'tm4b',from:'Admin User',role:'admin',text:'Photos in job file. Need MasTec to file replacement order.',ts:'2026-02-10T14:45:00Z'}]},
 {id:'TK-0005',subject:'96ct fiber shortage at warehouse',region:'Alabama',customer:'Brightspeed',priority:'normal',status:'Resolved',createdBy:'Admin User',createdByRole:'admin',createdAt:'2026-02-07T09:00:00Z',relatedJob:null,assignedTo:'u1',messages:[
 {id:'tm5a',from:'Admin User',role:'admin',text:'Only 2 spools of 96ct. Need 6 this week.',ts:'2026-02-07T09:00:00Z'},
 {id:'tm5b',from:'Jean-Luc Beer',role:'client_manager',text:'Shipment Wednesday. Reserving 8 spools.',ts:'2026-02-07T09:50:00Z'},
 {id:'tm5c',from:'Admin User',role:'admin',text:'Picked up. All good.',ts:'2026-02-09T11:00:00Z'}]}
 ]);


 const onSwitch=useCallback(uid=>{
 const u=USERS.find(u=>u.id===uid);
 if(u){setCU(u);setSelectedJob(null);setNavFrom(null);setJobsPreFilter("");
 if(u.role==="admin")setView("dashboard");
 else if(u.role==="lineman"||u.role==="foreman")setView("jobs");
 else if(u.role==="redline_specialist"||u.role==="billing")setView("jobs");
 else if(u.role==="supervisor")setView("supervisor_dashboard");
 else if(u.role==="client_manager")setView("client_portal");
 else if(u.role==="truck_investor")setView("investor_dashboard");
 else if(u.role==="drill_investor")setView("drill_investor_dashboard");
 else setView("jobs");
 }
 },[]);

 const[clientSubFilter,setClientSubFilter]=useState("all");
 const[clientDetailOpen,setClientDetailOpen]=useState(false);
 const[notifOpen,setNotifOpen]=useState(false);
 const[dismissedNotifs,setDismissedNotifs]=useState({});
 const[readNotifs,setReadNotifs]=useState({});

 // ─── NOTIFICATION ENGINE ─────────────────────────────────────────────────
 const notifications=useMemo(()=>{
  const now=new Date();const notifs=[];let nid=0;
  const daysUntil=(dateStr)=>{if(!dateStr)return 999;return Math.ceil((new Date(dateStr)-now)/(86400000));};
  const ago=(dateStr)=>{if(!dateStr)return 999;return Math.ceil((now-new Date(dateStr))/(86400000));};
  // ── Compliance: truck/drill expiry ──
  (trucks||[]).forEach(t=>{const c=t.compliance;if(!c)return;
   [{d:c.dotInspection?.expires,l:"DOT Inspection"},{d:c.insurance?.expires,l:"Insurance"},{d:c.registration?.expires,l:"Registration"},{d:c.oilChange?.nextDue,l:"Oil Change"},{d:c.tireInspection?.nextDue,l:"Tire Inspection"}].forEach(x=>{
    const d=daysUntil(x.d);
    if(d<0)notifs.push({id:`n${nid++}`,cat:"compliance",severity:"critical",icon:"trucks",title:`${t.id} — ${x.l} EXPIRED`,body:`Expired ${Math.abs(d)} days ago. Immediate action required.`,ts:x.d,roles:["admin","supervisor"]});
    else if(d<=14)notifs.push({id:`n${nid++}`,cat:"compliance",severity:d<=3?"critical":"warning",icon:"trucks",title:`${t.id} — ${x.l} expiring`,body:`Expires in ${d} day${d===1?"":"s"} (${x.d}).`,ts:x.d,roles:["admin","supervisor"]});
   });
  });
  (drills||[]).forEach(dr=>{const c=dr.compliance;if(!c)return;
   [{d:c.lastService?.nextDue,l:"Service"},{d:c.hydraulicInspection?.nextDue,l:"Hydraulic Inspection"},{d:c.bitReplacement?.nextDue,l:"Bit Replacement"}].forEach(x=>{
    const d=daysUntil(x.d);
    if(d<0)notifs.push({id:`n${nid++}`,cat:"compliance",severity:"critical",icon:"drills",title:`${dr.id} — ${x.l} OVERDUE`,body:`Overdue by ${Math.abs(d)} days.`,ts:x.d,roles:["admin","supervisor"]});
    else if(d<=14)notifs.push({id:`n${nid++}`,cat:"compliance",severity:d<=3?"critical":"warning",icon:"drills",title:`${dr.id} — ${x.l} due soon`,body:`Due in ${d} day${d===1?"":"s"}.`,ts:x.d,roles:["admin","supervisor"]});
   });
  });
  // ── CDL / Medical Card expiry ──
  Object.entries(CDL_DATA).forEach(([uid,cdl])=>{
   const u=USERS.find(x=>x.id===uid);if(!u)return;
   [{d:cdl.expires,l:"CDL"},{d:cdl.medicalCard?.expires,l:"Medical Card"}].forEach(x=>{
    const d=daysUntil(x.d);
    if(d<0)notifs.push({id:`n${nid++}`,cat:"compliance",severity:"critical",icon:"compliance",title:`${u.name} — ${x.l} EXPIRED`,body:`Expired ${Math.abs(d)} days ago. Cannot operate.`,ts:x.d,roles:["admin","supervisor"]});
    else if(d<=30)notifs.push({id:`n${nid++}`,cat:"compliance",severity:d<=7?"critical":"warning",icon:"compliance",title:`${u.name} — ${x.l} expiring`,body:`Expires in ${d} days (${x.d}).`,ts:x.d,roles:["admin","supervisor"]});
   });
  });
  // ── Low stock materials ──
  (trucks||[]).forEach(t=>{(t.inventory||[]).forEach(inv=>{
   const mat=MATERIALS.find(m=>m.id===inv.materialId);if(!mat)return;
   if(inv.qty<=mat.restockThreshold){
    const pct=Math.round((inv.qty/mat.restockThreshold)*100);
    notifs.push({id:`n${nid++}`,cat:"materials",severity:inv.qty<=mat.restockThreshold*0.5?"critical":"warning",icon:"materials",title:`Low stock: ${mat.name}`,body:`${t.id} has ${inv.qty.toLocaleString()} ${mat.unit} (restock at ${mat.restockThreshold.toLocaleString()}).`,ts:now.toISOString(),roles:["admin","supervisor"]});
   }
  });});
  // ── Job status alerts ──
  jobs.forEach(j=>{
   if(j.status==="Unassigned")notifs.push({id:`n${nid++}`,cat:"jobs",severity:"info",icon:"jobs",title:`Unassigned: ${j.id}`,body:`${j.customer} — ${j.address?.split(",")[0]||"No address"}. Needs crew assignment.`,ts:j.createdAt||now.toISOString(),roles:["admin","supervisor"]});
   if(j.production&&!j.redlineStatus)notifs.push({id:`n${nid++}`,cat:"jobs",severity:"info",icon:"redline",title:`Needs redline: ${j.id}`,body:`Production complete but no redline submitted.`,ts:j.production?.completedDate||now.toISOString(),roles:["admin","redline_specialist"]});
   if(j.redlineStatus==="pending_review")notifs.push({id:`n${nid++}`,cat:"jobs",severity:"info",icon:"review",title:`Redline pending review: ${j.id}`,body:`Submitted by ${j.redlineSubmittedBy||"crew"}, awaiting client approval.`,ts:now.toISOString(),roles:["admin","client_manager"]});
  });
  // ── Open tickets ──
  tickets.forEach(t=>{
   if(t.status==="Open"){
    const a=ago(t.createdAt);
    notifs.push({id:`n${nid++}`,cat:"tickets",severity:a>3?"warning":"info",icon:"tickets",title:`Open ticket: ${t.subject.slice(0,40)}`,body:`${t.region} · ${t.customer} · ${a}d old`,ts:t.createdAt,roles:["admin","supervisor","client_manager"]});
   }
  });
  // ── Invoices overdue (simple heuristic) ──
  (invoices||[]).forEach(inv=>{
   if(inv.status==="sent"){
    const a=ago(inv.createdAt);
    if(a>30)notifs.push({id:`n${nid++}`,cat:"billing",severity:"warning",icon:"paystubs",title:`Invoice overdue: ${inv.id}`,body:`Sent ${a} days ago to ${inv.billTo||"client"}. No payment recorded.`,ts:inv.createdAt,roles:["admin","billing"]});
   }
  });
  // Sort: critical first, then warning, then info, then by date
  const sev={critical:0,warning:1,info:2};
  notifs.sort((a,b)=>(sev[a.severity]||2)-(sev[b.severity]||2));
  return notifs;
 },[trucks,drills,jobs,tickets,invoices]);

 // Filter by role and dismissed
 const myNotifs=useMemo(()=>{
  return notifications.filter(n=>n.roles.includes(currentUser.role)&&!dismissedNotifs[n.id]);
 },[notifications,currentUser.role,dismissedNotifs]);
 const unreadCount=myNotifs.filter(n=>!readNotifs[n.id]).length;
 const markAllRead=()=>{const nr={...readNotifs};myNotifs.forEach(n=>{nr[n.id]=true;});setReadNotifs(nr);};
 const dismissNotif=(id)=>setDismissedNotifs(p=>({...p,[id]:true}));
 const dismissAll=()=>{const nd={...dismissedNotifs};myNotifs.forEach(n=>{nd[n.id]=true;});setDismissedNotifs(nd);};

 // Detect mobile with resize listener (must be before ctx)
 const[isMobile,setIsMobile]=useState(typeof window!=='undefined'&&window.innerWidth<768);
 useEffect(()=>{const h=()=>setIsMobile(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[]);

 const ctx={jobs,setJobs,rateCards,setRateCards,currentUser,view,setView,selectedJob,setSelectedJob,dark,setDark,paidStubs,setPaidStubs,payrollRuns,setPayrollRuns,bankAccounts,setBankAccounts,trucks,setTrucks,drills,setDrills,pickups,setPickups,materialMode,setMaterialMode,invoices,setInvoices,tickets,setTickets,navFrom,setNavFrom,jobsPreFilter,setJobsPreFilter,clientSubFilter,setClientSubFilter,clientDetailOpen,setClientDetailOpen,companyConfig,setCompanyConfig,notifications:myNotifs,unreadCount,isMobile};


 // DrillsView and TrucksView are defined at module level (above App)

 // ─── DRILL INVESTOR DASHBOARD ─────────────────────────────────────────────
 function DrillInvestorDashboard(){
 const myDrills=currentUser.drills||[];
 const[period,setPeriod]=useState("week");
 const now=new Date();
 const periodFilter=(j)=>{
 if(!j.production?.completedDate)return false;
 const d=new Date(j.production.completedDate);
 if(period==="week"){const mon=getMonday(now);return d>=mon;}
 if(period==="month"){return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}
 if(period==="year"){return d.getFullYear()===now.getFullYear();}
 return true;
 };
 const periodLabel={week:"This Week",month:"This Month",year:"This Year"};
 const drillData=myDrills.map(dId=>{
 const drill=drills.find(d=>d.id===dId);
 const dJobs=jobs.filter(j=>j.assignedDrill===dId);
 const completedJobs=dJobs.filter(j=>j.production);
 const periodJobs=completedJobs.filter(periodFilter);
 let totalReturns=0,totalFeet=0,periodReturns=0,periodFeet=0;
 completedJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals){totalReturns+=f.totals.investorCommission;totalFeet+=j.production?.totalFeet||0;}});
 periodJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals){periodReturns+=f.totals.investorCommission;periodFeet+=j.production?.totalFeet||0;}});
 const fm=dJobs.length>0?USERS.find(u=>u.id===dJobs[0].assignedLineman):null;
 return{drill,dId,fm,dJobs,completedJobs,periodJobs,totalReturns,totalFeet,periodReturns,periodFeet};
 });
 const grandPeriod=drillData.reduce((s,d)=>s+d.periodReturns,0);
 const grandTotal=drillData.reduce((s,d)=>s+d.totalReturns,0);
 return <div>
 <div style={{marginBottom:24}}><h1 style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:4}}>My Drills</h1><p style={{color:T.textMuted,fontSize:14}}>Track your drills and returns from underground production.</p></div>
 {/* Period toggle */}
 <div style={{display:"flex",gap:4,marginBottom:16,background:T.bgInput,borderRadius:4,padding:3,width:"fit-content"}}>
 {[{k:"week",l:"Week"},{k:"month",l:"Month"},{k:"year",l:"Year"}].map(p=>
 <button key={p.k} onClick={()=>setPeriod(p.k)} style={{padding:"6px 16px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",
 background:period===p.k?T.accent:"transparent",color:period===p.k?"#fff":T.textMuted,transition:"all 0.15s"}}>{p.l}</button>
 )}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:14,marginBottom:24}}>
 <Card style={{padding:20,background:`linear-gradient(135deg, ${T.bgCard}, ${T.bgCard})`,borderColor:T.success+"44"}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>{periodLabel[period]} Returns</div>
 <div style={{fontSize:32,fontWeight:600,color:T.success,marginTop:4}}>{$(grandPeriod)}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:4}}>All-time: {$(grandTotal)}</div>
 </Card>
 <Card style={{padding:20}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>My Drills</div><div style={{fontSize:32,fontWeight:600,color:T.accent,marginTop:4}}>{myDrills.length}</div></Card>
 <Card style={{padding:20}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>{periodLabel[period]} Production</div><div style={{fontSize:32,fontWeight:600,color:T.cyan,marginTop:4}}>{Math.round(drillData.reduce((s,d)=>s+d.periodFeet,0)).toLocaleString()} ft</div></Card>
 </div>
 {drillData.map(td=><Card key={td.dId} style={{marginBottom:16}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
 <div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{td.dId}</div><div style={{fontSize:12,color:T.textMuted}}>{td.drill?.label?.split("·")[1]?.trim()}</div></div>
 <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(td.periodReturns)}</div><div style={{fontSize:11,color:T.textMuted}}>{periodLabel[period].toLowerCase()} returns</div></div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:10}}>
 <div style={{padding:10,background:T.bgInput,borderRadius:4}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Foreman</div><div style={{fontSize:14,fontWeight:700,color:T.text,marginTop:2}}>{td.fm?.name||"Unassigned"}</div></div>
 <div style={{padding:10,background:T.bgInput,borderRadius:4}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Jobs</div><div style={{fontSize:14,fontWeight:700,color:T.text,marginTop:2}}>{td.dJobs.length}</div></div>
 <div style={{padding:10,background:T.bgInput,borderRadius:4}}><div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>{periodLabel[period]} Footage</div><div style={{fontSize:14,fontWeight:700,color:T.cyan,marginTop:2}}>{td.periodFeet.toLocaleString()} ft</div></div>
 </div>
 </Card>)}
 </div>;
 }

 // ─── DRILL INVESTOR STUBS ─────────────────────────────────────────────────
 function DrillInvestorStubsView(){
 const myDrills=currentUser.drills||[];
 const myWeeks=useMemo(()=>{
 const wks={};
 jobs.filter(j=>myDrills.includes(j.assignedDrill)&&j.production?.completedDate).forEach(j=>{
 const k=payWeekKey(new Date(j.production.completedDate));
 if(!wks[k])wks[k]={key:k,jobs:[],totalReturns:0};
 wks[k].jobs.push(j);
 const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals)wks[k].totalReturns+=f.totals.investorCommission;
 });return Object.values(wks).sort((a,b)=>b.key.localeCompare(a.key));
 },[jobs,rateCards,myDrills]);
 const[selWeek,setSelWeek]=useState(null);const sel=selWeek?myWeeks.find(w=>w.key===selWeek):null;
 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>My Returns</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 16px"}}>Weekly drill production returns</p>
 {sel?<div>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><Btn v="ghost" sz="sm" onClick={()=>setSelWeek(null)}>← Back</Btn><h2 style={{fontSize:16,fontWeight:700,color:T.text,margin:0}}>Week {weekNumber(sel.key)}</h2></div>
 <Card style={{marginBottom:14,padding:20,background:`linear-gradient(135deg, ${T.bgCard}, ${T.bgCard})`}}>
 <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
 <div><div style={{fontSize:18,fontWeight:600,color:T.text}}>Week {weekNumber(sel.key)}</div><div style={{fontSize:13,color:T.textMuted}}>{payWeekLabel(sel.key)}</div><div style={{fontSize:12,color:T.textMuted,marginTop:4}}>Pay Date: <b>{fd(payDate(sel.key))}</b></div></div>
 <div style={{textAlign:"right"}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Week Total</div><div style={{fontSize:36,fontWeight:600,color:T.success}}>{$(sel.totalReturns)}</div></div>
 </div>
 </Card>
 {sel.jobs.map((j,i)=>{const f=calcJob(j,rateCards);const ret=f.totals?.investorCommission||0;
 return <Card key={i} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div><span style={{fontWeight:700,color:T.accent,fontFamily:"monospace",fontSize:12}}>{j.feederId}</span><span style={{color:T.textMuted,fontSize:12}}> · {fd(j.production?.completedDate)}</span><div style={{fontSize:11,color:T.textDim}}>{j.assignedDrill} · {j.production?.totalFeet} ft · {j.production?.groundType||"Normal"}</div></div>
 <span style={{fontWeight:700,fontSize:14,color:T.success}}>{$(ret)}</span>
 </div>
 </Card>;
 })}
 </div>:<div>
 {myWeeks.length===0?<Card><p style={{color:T.textDim,textAlign:"center",padding:32}}>No returns yet.</p></Card>
 :myWeeks.map(w=><Card key={w.key} hover onClick={()=>setSelWeek(w.key)} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div><span style={{fontSize:14,fontWeight:700,color:T.accent}}>Week {weekNumber(w.key)}</span><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{payWeekLabel(w.key)}</div><div style={{fontSize:11,color:T.textDim}}>Pay Date: {fd(payDate(w.key))} · {w.jobs.length} jobs</div></div>
 <span style={{fontSize:20,fontWeight:600,color:T.success}}>{$(w.totalReturns)}</span>
 </div>
 </Card>)}
 </div>}
 </div>;
 }

 // ─── FOREMAN PAY STUBS ────────────────────────────────────────────────────
 function ForemanStubsView(){
 const[selWeek,setSelWeek]=useState(null);
 const myWeeks=useMemo(()=>{
 const wks={};
 jobs.filter(j=>j.assignedLineman===currentUser.id&&j.production?.completedDate&&j.department==="underground").forEach(j=>{
 const k=payWeekKey(new Date(j.production.completedDate));
 if(!wks[k])wks[k]={key:k,jobs:[],totalPay:0,fullDays:0,halfDays:0,conduitLt:0,conduitGt:0};
 wks[k].jobs.push(j);
 // Foreman pay: day rate + conduit footage
 (j.production.days||[]).forEach(d=>{
 if(d.fullDay)wks[k].fullDays++;
 if(d.halfDay)wks[k].halfDays++;
 const ft=d.conduitFeet||0;
 if(ft<=500)wks[k].conduitLt+=ft;else wks[k].conduitGt+=ft;
 });
 });
 Object.values(wks).forEach(w=>{
 w.totalPay=(w.fullDays*UG_PAY.fullDay)+(w.halfDays*UG_PAY.halfDay)+(w.conduitLt*UG_PAY.conduitLt)+(w.conduitGt*UG_PAY.conduitGt);
 const totalFt=w.conduitLt+w.conduitGt;
 if(totalFt>=UG_PAY.weeklyBonusThreshold)w.totalPay+=UG_PAY.weeklyBonus;
 w.totalFt=totalFt;w.hasBonus=totalFt>=UG_PAY.weeklyBonusThreshold;
 });
 return Object.values(wks).sort((a,b)=>b.key.localeCompare(a.key));
 },[jobs,currentUser]);
 const sel=selWeek?myWeeks.find(w=>w.key===selWeek):null;
 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>My Pay Stubs</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 16px"}}>Weekly underground production earnings</p>
 {sel?<div>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><Btn v="ghost" sz="sm" onClick={()=>setSelWeek(null)}>← Back</Btn><h2 style={{fontSize:16,fontWeight:700,color:T.text,margin:0}}>Week {weekNumber(sel.key)}</h2></div>
 <Card style={{marginBottom:14,padding:20,background:`linear-gradient(135deg, ${T.bgCard}, ${T.bgCard})`}}>
 <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
 <div><div style={{fontSize:18,fontWeight:600,color:T.text}}>Week {weekNumber(sel.key)}</div><div style={{fontSize:13,color:T.textMuted}}>{payWeekLabel(sel.key)}</div><div style={{fontSize:12,color:T.textMuted,marginTop:6}}>Pay Date: <b style={{color:T.text}}>{fd(payDate(sel.key))}</b></div></div>
 <div style={{textAlign:"right"}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Week Total</div><div style={{fontSize:36,fontWeight:600,color:T.success}}>{$(sel.totalPay)}</div></div>
 </div>
 </Card>
 {/* Pay breakdown */}
 <Card style={{marginBottom:14,padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:0.4}}>Earnings Breakdown</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))",gap:10}}>
 <div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Full Days</div><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(sel.fullDays*UG_PAY.fullDay)}</div><div style={{fontSize:11,color:T.textMuted}}>{sel.fullDays} × {$(UG_PAY.fullDay)}</div></div>
 {sel.halfDays>0&&<div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Half Days</div><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(sel.halfDays*UG_PAY.halfDay)}</div><div style={{fontSize:11,color:T.textMuted}}>{sel.halfDays} × {$(UG_PAY.halfDay)}</div></div>}
 {sel.conduitLt>0&&<div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Conduit {"<"} 500ft</div><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(sel.conduitLt*UG_PAY.conduitLt)}</div><div style={{fontSize:11,color:T.textMuted}}>{sel.conduitLt} ft × {$(UG_PAY.conduitLt)}</div></div>}
 {sel.conduitGt>0&&<div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Conduit {">"} 500ft</div><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(sel.conduitGt*UG_PAY.conduitGt)}</div><div style={{fontSize:11,color:T.textMuted}}>{sel.conduitGt} ft × {$(UG_PAY.conduitGt)}</div></div>}
 {sel.hasBonus&&<div style={{padding:12,background:T.successSoft,borderRadius:4,border:`1px solid ${T.success}33`}}><div style={{fontSize:12,fontWeight:600,color:T.success}}>4000ft+ Bonus</div><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(UG_PAY.weeklyBonus)}</div><div style={{fontSize:11,color:T.textMuted}}>{sel.totalFt.toLocaleString()} ft this week</div></div>}
 </div>
 </Card>
 {/* Per-job breakdown */}
 {sel.jobs.map((j,i)=><Card key={i} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
 <div><span style={{fontWeight:700,color:T.accent,fontFamily:"monospace",fontSize:12}}>{j.feederId}</span><span style={{color:T.textMuted,fontSize:12}}> · {fd(j.production?.completedDate)}</span></div>
 <Badge label={j.production?.groundType||"Normal"} color={j.production?.groundType==="Rock"?T.danger:j.production?.groundType==="Cobble"?T.warning:T.text} bg={j.production?.groundType==="Rock"?T.dangerSoft:j.production?.groundType==="Cobble"?T.warningSoft:T.bgInput}/>
 </div>
 <div style={{fontSize:12,color:T.textMuted}}>{j.production?.totalFeet} ft · {(j.production?.days||[]).filter(d=>d.fullDay).length} full day{(j.production?.days||[]).filter(d=>d.fullDay).length!==1?"s":""}</div>
 </Card>)}
 </div>:<div>
 {myWeeks.length===0?<Card><p style={{color:T.textDim,textAlign:"center",padding:32}}>No pay stubs yet. Submit production to see earnings.</p></Card>
 :myWeeks.map(w=><Card key={w.key} hover onClick={()=>setSelWeek(w.key)} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14,fontWeight:700,color:T.accent}}>Week {weekNumber(w.key)}</span>{w.hasBonus&&<Badge label="4000ft+ BONUS" color={T.success} bg={T.successSoft}/>}</div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{payWeekLabel(w.key)}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:1}}>Pay Date: {fd(payDate(w.key))} · {w.jobs.length} jobs · {w.totalFt.toLocaleString()} ft</div>
 </div>
 <span style={{fontSize:20,fontWeight:600,color:T.success}}>{$(w.totalPay)}</span>
 </div>
 </Card>)}
 </div>}
 </div>;
 }

 // ─── SUPERVISOR PAY STUBS ─────────────────────────────────────────────────
 function SupervisorStubsView(){
 const[selWeek,setSelWeek]=useState(null);
 const scope=currentUser.scope||{};
 const salary=currentUser.weeklySalary||1500;
 const commRate=currentUser.commissionRate||0.03;
 const myWeeks=useMemo(()=>{
 const wks={};
 jobs.filter(j=>j.production?.completedDate&&j.customer===scope.customer&&j.region===scope.region).forEach(j=>{
 const k=payWeekKey(new Date(j.production.completedDate));
 if(!wks[k])wks[k]={key:k,jobs:[],totalRev:0,commission:0,salary,totalPay:0,totalFeet:0};
 const f=calcJob(j,rateCards);
 if(f.status==="Calculated"&&f.totals){
 wks[k].jobs.push({...j,rev:f.totals.nextgenRevenue,feet:j.production?.totalFeet||0});
 wks[k].totalRev+=f.totals.nextgenRevenue;
 wks[k].totalFeet+=j.production?.totalFeet||0;
 }
 });
 Object.values(wks).forEach(w=>{
 w.commission=+(w.totalRev*commRate).toFixed(2);
 w.totalPay=+(w.salary+w.commission).toFixed(2);
 });
 return Object.values(wks).sort((a,b)=>b.key.localeCompare(a.key));
 },[jobs,rateCards,currentUser,scope,salary,commRate]);
 const sel=selWeek?myWeeks.find(w=>w.key===selWeek):null;
 return <div>
 <h1 style={{fontSize:18,fontWeight:600,margin:0,color:T.text}}>My Pay Stubs</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 4px"}}>Weekly salary + production commission</p>
 <p style={{color:T.textDim,fontSize:11,margin:"0 0 16px"}}>Region: {scope.customer} · {scope.region} · {(commRate*100).toFixed(0)}% commission on revenue</p>
 {sel?<div>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><Btn v="ghost" sz="sm" onClick={()=>setSelWeek(null)}>← Back</Btn><h2 style={{fontSize:16,fontWeight:700,color:T.text,margin:0}}>Week {weekNumber(sel.key)}</h2></div>
 <Card style={{marginBottom:14,padding:20}}>
 <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
 <div><div style={{fontSize:18,fontWeight:600,color:T.text}}>Week {weekNumber(sel.key)}</div><div style={{fontSize:13,color:T.textMuted}}>{payWeekLabel(sel.key)}</div><div style={{fontSize:12,color:T.textMuted,marginTop:6}}>Pay Date: <b style={{color:T.text}}>{fd(payDate(sel.key))}</b></div></div>
 <div style={{textAlign:"right"}}><div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Week Total</div><div style={{fontSize:36,fontWeight:600,color:T.success}}>{$(sel.totalPay)}</div></div>
 </div>
 </Card>
 <Card style={{marginBottom:14,padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:0.4}}>Earnings Breakdown</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10}}>
 <div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Weekly Salary</div><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(salary)}</div><div style={{fontSize:11,color:T.textMuted}}>Fixed weekly</div></div>
 <div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Commission</div><div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(sel.commission)}</div><div style={{fontSize:11,color:T.textMuted}}>{(commRate*100).toFixed(0)}% of {$(sel.totalRev)} revenue</div></div>
 <div style={{padding:12,background:T.bgInput,borderRadius:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>Production</div><div style={{fontSize:18,fontWeight:600,color:T.text}}>{sel.totalFeet.toLocaleString()} ft</div><div style={{fontSize:11,color:T.textMuted}}>{sel.jobs.length} jobs this week</div></div>
 </div>
 </Card>
 <Card style={{padding:14}}>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:0.4}}>Jobs in Region</div>
 <DT columns={[
 {key:"id",label:"Job",render:r=><span style={{fontFamily:"monospace",fontSize:11,color:T.accent}}>{r.id}</span>},
 {key:"feeder",label:"Feeder",render:r=><span style={{fontFamily:"monospace",fontSize:11}}>{r.feederId}</span>},
 {key:"lineman",label:"Lineman",render:r=><span>{USERS.find(u=>u.id===r.assignedLineman)?.name||"—"}</span>},
 {key:"feet",label:"Footage",render:r=><span style={{fontWeight:600}}>{r.feet} ft</span>},
 {key:"rev",label:"Revenue",render:r=><span style={{color:T.success,fontWeight:600}}>{$(r.rev)}</span>},
 {key:"comm",label:"Your Commission",render:r=><span style={{color:T.success,fontWeight:600}}>{$(+(r.rev*commRate).toFixed(2))}</span>},
 ]} data={sel.jobs}/>
 </Card>
 </div>:<div>
 {myWeeks.length===0?<Card><p style={{color:T.textDim,textAlign:"center",padding:32}}>No pay stubs yet. Production in your region will appear here.</p></Card>
 :myWeeks.map(w=><Card key={w.key} hover onClick={()=>setSelWeek(w.key)} style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <span style={{fontSize:14,fontWeight:700,color:T.accent}}>Week {weekNumber(w.key)}</span>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{payWeekLabel(w.key)}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:1}}>Pay Date: {fd(payDate(w.key))} · {w.jobs.length} jobs · {w.totalFeet.toLocaleString()} ft</div>
 </div>
 <div style={{textAlign:"right"}}>
 <span style={{fontSize:20,fontWeight:600,color:T.success}}>{$(w.totalPay)}</span>
 <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>{$(salary)} salary + {$(w.commission)} comm.</div>
 </div>
 </div>
 </Card>)}
 </div>}
 </div>;
 }

 // TrucksView defined at module level (above App)

 // ─── TRUCK INVESTOR DASHBOARD ──────────────────────────────────────────────
 function InvestorDashboard(){
 const myTrucks=currentUser.trucks||[];
 const[period,setPeriod]=useState("week");
 const now=new Date();
 const periodFilter=(j)=>{
 if(!j.production?.completedDate)return false;
 const d=new Date(j.production.completedDate);
 if(period==="week"){const mon=getMonday(now);return d>=mon;}
 if(period==="month"){return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}
 if(period==="year"){return d.getFullYear()===now.getFullYear();}
 return true;
 };
 const periodLabel={week:"This Week",month:"This Month",year:"This Year"};
 const truckData=myTrucks.map(tId=>{
 const truck=trucks.find(t=>t.id===tId);
 const truckJobs=jobs.filter(j=>j.assignedTruck===tId);
 const activeJobs=truckJobs.filter(j=>j.status==="Assigned");
 const completedJobs=truckJobs.filter(j=>j.production);
 const periodJobs=completedJobs.filter(periodFilter);
 let totalReturns=0,totalFeet=0,periodReturns=0,periodFeet=0;
 completedJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals){totalReturns+=f.totals.investorCommission;totalFeet+=j.production?.totalFeet||0;}});
 periodJobs.forEach(j=>{const f=calcJob(j,rateCards);if(f.status==="Calculated"&&f.totals){periodReturns+=f.totals.investorCommission;periodFeet+=j.production?.totalFeet||0;}});
 const lineman=truckJobs.length>0?USERS.find(u=>u.id===truckJobs[0].assignedLineman):null;
 return{truck,tId,lineman,truckJobs,activeJobs,completedJobs,periodJobs,totalReturns,totalFeet,periodReturns,periodFeet};
 });
 const grandPeriod=truckData.reduce((s,t)=>s+t.periodReturns,0);
 const grandTotal=truckData.reduce((s,t)=>s+t.totalReturns,0);
 const grandJobs=truckData.reduce((s,t)=>s+t.periodJobs.length,0);

 return <div>
 <div style={{marginBottom:24}}>
 <h1 style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:4}}>My Trucks</h1>
 <p style={{color:T.textMuted,fontSize:14}}>Track your trucks, who's using them, and your returns from production.</p>
 </div>

 {/* Period toggle */}
 <div style={{display:"flex",gap:4,marginBottom:16,background:T.bgInput,borderRadius:4,padding:3,width:"fit-content"}}>
 {[{k:"week",l:"Week"},{k:"month",l:"Month"},{k:"year",l:"Year"}].map(p=>
 <button key={p.k} onClick={()=>setPeriod(p.k)} style={{padding:"6px 16px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",
 background:period===p.k?T.accent:"transparent",color:period===p.k?"#fff":T.textMuted,transition:"all 0.15s"}}>{p.l}</button>
 )}
 </div>

 {/* Summary Cards */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:14,marginBottom:24}}>
 <Card style={{padding:20,background:`linear-gradient(135deg, ${T.bgCard}, ${T.bgCard})`,borderColor:T.success+"44"}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>{periodLabel[period]} Returns</div>
 <div style={{fontSize:32,fontWeight:600,color:T.success,marginTop:4}}>{$(grandPeriod)}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:4}}>{grandJobs} jobs · All-time: {$(grandTotal)}</div>
 </Card>
 <Card style={{padding:20}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Active Trucks</div>
 <div style={{fontSize:32,fontWeight:600,color:T.accent,marginTop:4}}>{myTrucks.length}</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:4}}>{truckData.filter(t=>t.activeJobs.length>0).length} currently assigned</div>
 </Card>
 <Card style={{padding:20}}>
 <div style={{fontSize:11,color:T.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>{periodLabel[period]} Production</div>
 <div style={{fontSize:32,fontWeight:600,color:T.cyan,marginTop:4}}>{Math.round(truckData.reduce((s,t)=>s+t.periodFeet,0)).toLocaleString()} ft</div>
 <div style={{fontSize:11,color:T.textDim,marginTop:4}}>across all trucks</div>
 </Card>
 </div>

 {/* Per-truck cards */}
 {truckData.map(td=><Card key={td.tId} style={{marginBottom:16,padding:0,overflow:"hidden"}}>
 <div style={{padding:"16px 20px",background:T.bgCard,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
 <div>
 <div style={{fontSize:16,fontWeight:700,color:T.text}}>{td.tId}</div>
 <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{td.truck?.label?.split("·")[1]?.trim()||""}</div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:18,fontWeight:600,color:T.success}}>{$(td.periodReturns)}</div>
 <div style={{fontSize:11,color:T.textMuted}}>{periodLabel[period].toLowerCase()} returns</div>
 </div>
 </div>
 <div style={{padding:"14px 20px"}}>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12,marginBottom:14}}>
 <div style={{padding:10,background:T.bgInput,borderRadius:4}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Assigned To</div>
 <div style={{fontSize:14,fontWeight:700,color:td.lineman?T.text:T.textDim,marginTop:2}}>{td.lineman?.name||"Unassigned"}</div>
 </div>
 <div style={{padding:10,background:T.bgInput,borderRadius:4}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Total Jobs</div>
 <div style={{fontSize:14,fontWeight:700,color:T.text,marginTop:2}}>{td.truckJobs.length}</div>
 </div>
 <div style={{padding:10,background:T.bgInput,borderRadius:4}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Active</div>
 <div style={{fontSize:14,fontWeight:700,color:T.accent,marginTop:2}}>{td.activeJobs.length}</div>
 </div>
 <div style={{padding:10,background:T.bgInput,borderRadius:4}}>
 <div style={{fontSize:10,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>Completed</div>
 <div style={{fontSize:14,fontWeight:700,color:T.success,marginTop:2}}>{td.completedJobs.length}</div>
 </div>
 </div>
 {/* Recent completed jobs */}
 {td.completedJobs.length>0&&<>
 <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Recent Production</div>
 <DT columns={[
 {key:"feederId",label:"Feeder/Run",render:r=><span style={{fontWeight:600,color:T.accent,fontFamily:"monospace",fontSize:12}}>{r.feederId}</span>},
 {key:"date",label:"Date",render:r=>fd(r.production?.completedDate)},
 {key:"feet",label:"Footage",render:r=>`${(r.production?.totalFeet||0).toLocaleString()} ft`},
 {key:"paid",label:"Payment",render:r=>{const st=r.status;return st==="Billed"?<Badge label="Paid" color={T.success} bg={T.successSoft}/>:<Badge label="Pending" color={T.warning} bg={T.warningSoft}/>;}},
 {key:"returns",label:"Your Returns",render:r=>{const f=calcJob(r,rateCards);return f.status==="Calculated"&&f.totals?<span style={{fontWeight:700,color:T.success}}>{$(f.totals.investorCommission)}</span>:<span style={{color:T.textDim}}>—</span>;}},
 ]} data={td.completedJobs.slice(0,10)}/>
 </>}
 </div>
 </Card>)}
 </div>;
 }

 // ─── TRUCK HEALTH (Investor) ──────────────────────────────────────────────
 function TruckHealthView(){
 const now=new Date();
 const myTrucks=(currentUser.trucks||[]).map(tId=>trucks.find(t=>t.id===tId)).filter(Boolean);
 const daysUntil=(dateStr)=>{if(!dateStr)return 999;return Math.round((new Date(dateStr)-now)/86400000);};
 const urgency=(days)=>days<0?{label:"OVERDUE",c:T.danger,bg:T.dangerSoft}:days<=14?{label:`${days}d`,c:T.danger,bg:T.dangerSoft}:days<=30?{label:`${days}d`,c:T.warning,bg:T.warningSoft}:days<=60?{label:`${days}d`,c:"#FACC15",bg:"#FACC1518"}:{label:`${days}d`,c:T.success,bg:T.successSoft};
 const[editing,setEditing]=useState(null); // {truckId, itemKey}
 const[editVals,setEditVals]=useState({});

 const alerts=[];
 myTrucks.forEach(t=>{const c=t.compliance;
  if(daysUntil(c.dotInspection?.expires)<=30)alerts.push({truck:t.id,item:"DOT Inspection",days:daysUntil(c.dotInspection.expires)});
  if(daysUntil(c.insurance?.expires)<=30)alerts.push({truck:t.id,item:"Insurance",days:daysUntil(c.insurance.expires)});
  if(daysUntil(c.registration?.expires)<=30)alerts.push({truck:t.id,item:"Registration",days:daysUntil(c.registration.expires)});
  if(daysUntil(c.oilChange?.nextDue)<=14)alerts.push({truck:t.id,item:"Oil Change",days:daysUntil(c.oilChange.nextDue)});
  if(daysUntil(c.tireInspection?.nextDue)<=30)alerts.push({truck:t.id,item:"Tire Inspection",days:daysUntil(c.tireInspection.nextDue)});
 });

 const openEdit=(truckId,itemKey,current)=>{
  setEditing({truckId,itemKey});
  setEditVals({...current});
 };
 const saveEdit=()=>{
  if(!editing)return;
  setTrucks(prev=>prev.map(t=>{
  if(t.id!==editing.truckId)return t;
  const c={...t.compliance};
  if(editing.itemKey==="dot")c.dotInspection={...c.dotInspection,...editVals};
  if(editing.itemKey==="insurance")c.insurance={...c.insurance,...editVals};
  if(editing.itemKey==="registration")c.registration={...c.registration,...editVals};
  if(editing.itemKey==="oil")c.oilChange={...c.oilChange,...editVals};
  if(editing.itemKey==="tires")c.tireInspection={...c.tireInspection,...editVals};
  return{...t,compliance:c};
  }));
  setEditing(null);setEditVals({});
 };

 const InputRow=({label,field,type})=><div style={{marginBottom:8}}>
  <label style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.3,display:"block",marginBottom:3}}>{label}</label>
  <input type={type||"date"} value={editVals[field]||""} onChange={e=>setEditVals(p=>({...p,[field]:e.target.value}))} style={{width:"100%",padding:"7px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/>
 </div>;

 return <div>
  <div style={{marginBottom:20}}>
  <div style={{fontSize:10,color:T.purple,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Vehicle Health</div>
  <h1 style={{fontSize:22,fontWeight:600,margin:0,color:T.text}}>Maintenance & Compliance</h1>
  <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{myTrucks.length} vehicle{myTrucks.length!==1?"s":""} · {alerts.length} item{alerts.length!==1?"s":""} need attention</p>
  </div>

  {alerts.length>0&&<Card style={{padding:0,overflow:"hidden",marginBottom:16,borderLeft:`3px solid ${T.danger}`}}>
  <div style={{padding:"12px 18px",background:T.dangerSoft}}>
   <div style={{fontSize:13,fontWeight:700,color:T.danger,marginBottom:6}}>Action Required</div>
   {alerts.sort((a,b)=>a.days-b.days).map((a,i)=>{const u=urgency(a.days);
   return <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:12}}>
    <Badge label={u.label} color={u.c} bg={u.bg}/>
    <span style={{color:T.text,fontWeight:600}}>{a.truck}</span>
    <span style={{color:T.textMuted}}>{a.item}</span>
    {a.days<0&&<span style={{color:T.danger,fontWeight:700}}>— {Math.abs(a.days)} days overdue</span>}
   </div>;
   })}
  </div>
  </Card>}

  {myTrucks.map(t=>{const c=t.compliance;const lm=USERS.find(u=>jobs.some(j=>j.assignedTruck===t.id&&j.assignedLineman===u.id));
  const items=[
   {key:"dot",label:"DOT Inspection",last:c.dotInspection?.date,expires:c.dotInspection?.expires,icon:"🔍",current:{date:c.dotInspection?.date||"",expires:c.dotInspection?.expires||""},fields:[{label:"Last Inspection",field:"date"},{label:"Expires",field:"expires"}]},
   {key:"insurance",label:"Insurance",last:null,expires:c.insurance?.expires,detail:`${c.insurance?.provider||""} · ${c.insurance?.policy||""}`,icon:"🛡",current:{provider:c.insurance?.provider||"",policy:c.insurance?.policy||"",expires:c.insurance?.expires||""},fields:[{label:"Provider",field:"provider",type:"text"},{label:"Policy #",field:"policy",type:"text"},{label:"Expires",field:"expires"}]},
   {key:"registration",label:"Registration",last:null,expires:c.registration?.expires,detail:`State: ${c.registration?.state||""}`,icon:"📋",current:{state:c.registration?.state||"",expires:c.registration?.expires||""},fields:[{label:"State",field:"state",type:"text"},{label:"Expires",field:"expires"}]},
   {key:"oil",label:"Oil Change",last:c.oilChange?.last,expires:c.oilChange?.nextDue,detail:c.oilChange?.mileage?`${c.oilChange.mileage.toLocaleString()} mi`:"",icon:"🔧",current:{last:c.oilChange?.last||"",nextDue:c.oilChange?.nextDue||"",mileage:String(c.oilChange?.mileage||"")},fields:[{label:"Last Service",field:"last"},{label:"Next Due",field:"nextDue"},{label:"Mileage",field:"mileage",type:"number"}]},
   {key:"tires",label:"Tire Inspection",last:c.tireInspection?.date,expires:c.tireInspection?.nextDue,icon:"⚙",current:{date:c.tireInspection?.date||"",nextDue:c.tireInspection?.nextDue||""},fields:[{label:"Last Inspection",field:"date"},{label:"Next Due",field:"nextDue"}]},
  ];
  return <Card key={t.id} style={{marginBottom:16,padding:0,overflow:"hidden"}}>
   <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
   <div>
    <div style={{fontSize:16,fontWeight:700,color:T.text}}>{t.id}</div>
    <div style={{fontSize:12,color:T.textMuted}}>{t.label.split("·")[1]?.trim()||t.label}</div>
    <div style={{fontSize:11,color:T.textDim,marginTop:2}}>VIN: {t.vin}{lm?` · Assigned to ${lm.name}`:""}</div>
   </div>
   {items.some(it=>daysUntil(it.expires)<=14)?<Badge label="Needs Attention" color={T.danger} bg={T.dangerSoft}/>:<Badge label="Good Standing" color={T.success} bg={T.successSoft}/>}
   </div>
   <div style={{padding:"14px 20px"}}>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",gap:10}}>
    {items.map(it=>{const days=daysUntil(it.expires);const u=urgency(days);const isEditing=editing?.truckId===t.id&&editing?.itemKey===it.key;
    return <div key={it.key} style={{padding:"12px 14px",background:isEditing?T.accentSoft:T.bgInput,borderRadius:6,borderLeft:`3px solid ${u.c}`,cursor:isEditing?"default":"pointer",transition:"all 0.15s"}} onClick={()=>{if(!isEditing)openEdit(t.id,it.key,it.current);}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
     <span style={{fontSize:12,fontWeight:600,color:T.text}}>{it.icon} {it.label}</span>
     {!isEditing&&<Badge label={days<0?`${Math.abs(days)}d overdue`:u.label} color={u.c} bg={u.bg}/>}
    </div>
    {isEditing?<div onClick={e=>e.stopPropagation()}>
     {it.fields.map(f=><InputRow key={f.field} label={f.label} field={f.field} type={f.type}/>)}
     <div style={{display:"flex",gap:6,marginTop:8}}>
     <button onClick={saveEdit} style={{flex:1,padding:"6px",borderRadius:4,border:"none",background:T.accent,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Save</button>
     <button onClick={()=>{setEditing(null);setEditVals({});}} style={{flex:1,padding:"6px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,fontSize:11,fontWeight:600,cursor:"pointer"}}>Cancel</button>
     </div>
    </div>:<>
     {it.last&&<div style={{fontSize:11,color:T.textMuted}}>Last: {fd(it.last)}</div>}
     <div style={{fontSize:11,color:days<=14?u.c:T.textMuted,fontWeight:days<=14?600:400}}>{it.expires?`Due: ${fd(it.expires)}`:"No date"}</div>
     {it.detail&&<div style={{fontSize:10,color:T.textDim,marginTop:2}}>{it.detail}</div>}
     <div style={{fontSize:9,color:T.accent,marginTop:4,fontWeight:600}}>Click to update →</div>
    </>}
    </div>;
    })}
   </div>
   </div>
  </Card>;
  })}
 </div>;
 }

 // ─── DRILL HEALTH (Investor) ──────────────────────────────────────────────
 function DrillHealthView(){
 const now=new Date();
 const myDrills=(currentUser.drills||[]).map(dId=>drills.find(d=>d.id===dId)).filter(Boolean);
 const daysUntil=(dateStr)=>{if(!dateStr)return 999;return Math.round((new Date(dateStr)-now)/86400000);};
 const urgency=(days)=>days<0?{label:"OVERDUE",c:T.danger,bg:T.dangerSoft}:days<=14?{label:`${days}d`,c:T.danger,bg:T.dangerSoft}:days<=30?{label:`${days}d`,c:T.warning,bg:T.warningSoft}:{label:`${days}d`,c:T.success,bg:T.successSoft};
 const[editing,setEditing]=useState(null);
 const[editVals,setEditVals]=useState({});

 const openEdit=(drillId,itemKey,current)=>{setEditing({drillId,itemKey});setEditVals({...current});};
 const saveEdit=()=>{
  if(!editing)return;
  setDrills(prev=>prev.map(d=>{
  if(d.id!==editing.drillId)return d;
  const c={...d.compliance};
  if(editing.itemKey==="service")c.lastService={...c.lastService,...editVals};
  if(editing.itemKey==="hydraulic")c.hydraulicInspection={...c.hydraulicInspection,...editVals};
  if(editing.itemKey==="bit")c.bitReplacement={...c.bitReplacement,...editVals};
  return{...d,compliance:c};
  }));
  setEditing(null);setEditVals({});
 };
 const InputRow=({label,field,type})=><div style={{marginBottom:8}}>
  <label style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.3,display:"block",marginBottom:3}}>{label}</label>
  <input type={type||"date"} value={editVals[field]||""} onChange={e=>setEditVals(p=>({...p,[field]:e.target.value}))} style={{width:"100%",padding:"7px 10px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/>
 </div>;

 return <div>
  <div style={{marginBottom:20}}>
  <div style={{fontSize:10,color:T.purple,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Equipment Health</div>
  <h1 style={{fontSize:22,fontWeight:600,margin:0,color:T.text}}>Drill Maintenance</h1>
  <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{myDrills.length} unit{myDrills.length!==1?"s":""}</p>
  </div>
  {myDrills.map(d=>{const c=d.compliance;
  const items=[
   {key:"service",label:"Service",last:c.lastService?.date,expires:c.lastService?.nextDue,detail:`${c.lastService?.hours||0} hours`,icon:"🔧",current:{date:c.lastService?.date||"",nextDue:c.lastService?.nextDue||"",hours:String(c.lastService?.hours||"")},fields:[{label:"Last Service",field:"date"},{label:"Next Due",field:"nextDue"},{label:"Hours",field:"hours",type:"number"}]},
   {key:"hydraulic",label:"Hydraulic Inspection",last:c.hydraulicInspection?.date,expires:c.hydraulicInspection?.nextDue,icon:"💧",current:{date:c.hydraulicInspection?.date||"",nextDue:c.hydraulicInspection?.nextDue||""},fields:[{label:"Last Inspection",field:"date"},{label:"Next Due",field:"nextDue"}]},
   {key:"bit",label:"Bit Replacement",last:c.bitReplacement?.date,expires:c.bitReplacement?.nextDue,detail:`${c.bitReplacement?.bitsUsed||0} bits used`,icon:"⚙",current:{date:c.bitReplacement?.date||"",nextDue:c.bitReplacement?.nextDue||"",bitsUsed:String(c.bitReplacement?.bitsUsed||"")},fields:[{label:"Last Replaced",field:"date"},{label:"Next Due",field:"nextDue"},{label:"Bits Used",field:"bitsUsed",type:"number"}]},
  ];
  return <Card key={d.id} style={{marginBottom:16,padding:0,overflow:"hidden"}}>
   <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
   <div>
    <div style={{fontSize:16,fontWeight:700,color:T.text}}>{d.id}</div>
    <div style={{fontSize:12,color:T.textMuted}}>{d.label.split("·")[1]?.trim()||d.label}</div>
   </div>
   </div>
   <div style={{padding:"14px 20px"}}>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",gap:10}}>
    {items.map(it=>{const days=daysUntil(it.expires);const u=urgency(days);const isEditing=editing?.drillId===d.id&&editing?.itemKey===it.key;
    return <div key={it.key} style={{padding:"12px 14px",background:isEditing?T.accentSoft:T.bgInput,borderRadius:6,borderLeft:`3px solid ${u.c}`,cursor:isEditing?"default":"pointer",transition:"all 0.15s"}} onClick={()=>{if(!isEditing)openEdit(d.id,it.key,it.current);}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
     <span style={{fontSize:12,fontWeight:600,color:T.text}}>{it.icon} {it.label}</span>
     {!isEditing&&<Badge label={days<0?`${Math.abs(days)}d overdue`:u.label} color={u.c} bg={u.bg}/>}
    </div>
    {isEditing?<div onClick={e=>e.stopPropagation()}>
     {it.fields.map(f=><InputRow key={f.field} label={f.label} field={f.field} type={f.type}/>)}
     <div style={{display:"flex",gap:6,marginTop:8}}>
     <button onClick={saveEdit} style={{flex:1,padding:"6px",borderRadius:4,border:"none",background:T.accent,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Save</button>
     <button onClick={()=>{setEditing(null);setEditVals({});}} style={{flex:1,padding:"6px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,fontSize:11,fontWeight:600,cursor:"pointer"}}>Cancel</button>
     </div>
    </div>:<>
     {it.last&&<div style={{fontSize:11,color:T.textMuted}}>Last: {fd(it.last)}</div>}
     <div style={{fontSize:11,color:days<=14?u.c:T.textMuted,fontWeight:days<=14?600:400}}>{it.expires?`Due: ${fd(it.expires)}`:"No date"}</div>
     {it.detail&&<div style={{fontSize:10,color:T.textDim,marginTop:2}}>{it.detail}</div>}
     <div style={{fontSize:9,color:T.accent,marginTop:4,fontWeight:600}}>Click to update →</div>
    </>}
    </div>;
    })}
   </div>
   </div>
  </Card>;
  })}
 </div>;
 }

 // ─── SUPERVISOR DASHBOARD ──────────────────────────────────────────────────
 function SupervisorDashboard(){
 const{jobs,rateCards,currentUser,tickets,trucks,drills,setView,setSelectedJob,setNavFrom,setJobsPreFilter}=useApp();
 const navigateTo=(target,preFilter)=>{setNavFrom({view:"supervisor_dashboard",label:"Dashboard"});if(preFilter)setJobsPreFilter(preFilter);setView(target);};
 const now=new Date();
 const scope=currentUser.scope||{};
 const linemen=USERS.filter(u=>u.role==="lineman"||u.role==="foreman");

 // Jobs in supervisor's region (or all if no scope)
 const myJobs=jobs.filter(j=>!scope.region||j.region===scope.region);
 const thisWeekKey=payWeekKey(now);

 // Crew deployment — who's doing what today
 const crewStatus=linemen.map(lm=>{
 const lmJobs=myJobs.filter(j=>j.assignedLineman===lm.id);
 const activeJob=lmJobs.find(j=>j.status==="Assigned");
 const pendingSubmissions=lmJobs.filter(j=>j.status==="Assigned").length;
 const completedThisWeek=lmJobs.filter(j=>j.production?.completedDate&&payWeekKey(new Date(j.production.completedDate))===thisWeekKey).length;
 const weekFeet=lmJobs.filter(j=>j.production?.completedDate&&payWeekKey(new Date(j.production.completedDate))===thisWeekKey).reduce((s,j)=>s+(j.production?.totalFeet||0),0);
 const truck=activeJob?trucks.find(t=>t.id===activeJob.assignedTruck):null;
 return{lm,activeJob,pendingSubmissions,completedThisWeek,weekFeet,truck,total:lmJobs.length};
 });

 // Stats
 const unassigned=myJobs.filter(j=>j.status==="Unassigned").length;
 const inProgress=myJobs.filter(j=>j.status==="Assigned").length;
 const pendingRedlines=myJobs.filter(j=>j.status==="Pending Redlines").length;
 const underReview=myJobs.filter(j=>j.status==="Under Client Review").length;
 const weekFeetTotal=crewStatus.reduce((s,c)=>s+c.weekFeet,0);
 const weekJobsTotal=crewStatus.reduce((s,c)=>s+c.completedThisWeek,0);

 // My tickets
 const myTickets=(tickets||[]).filter(t=>t.createdBy===currentUser.name||t.assignedTo===currentUser.id||(scope.region&&t.region===scope.region));
 const openTickets=myTickets.filter(t=>t.status==="Open"||t.status==="Acknowledged");

 // Compliance alerts for my trucks
 const myTruckIds=[...new Set(myJobs.filter(j=>j.assignedTruck).map(j=>j.assignedTruck))];
 const compAlerts=[];
 myTruckIds.forEach(tid=>{const t=trucks.find(x=>x.id===tid);if(!t?.compliance)return;const c=t.compliance;
 [{d:c.dotInspection?.expires,l:"DOT"},{d:c.insurance?.expires,l:"Ins"},{d:c.oilChange?.nextDue,l:"Oil"},{d:c.tireInspection?.nextDue,l:"Tires"}].forEach(x=>{const s=complianceStatus(x.d);if(s.status==="expired"||s.status==="critical"||s.status==="warning")compAlerts.push({truck:t,type:x.l,status:s});});});

 // Recent production in my region
 const recentProd=myJobs.filter(j=>j.production?.submittedAt).sort((a,b)=>b.production.submittedAt.localeCompare(a.production.submittedAt)).slice(0,6);

 return <div>
 <div style={{marginBottom:20}}>
 <h1 style={{fontSize:20,fontWeight:600,margin:0,color:T.text}}>Supervisor Dashboard</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:"4px 0 0"}}>{scope.region||"All Regions"} · {myJobs.length} jobs · Week of {thisWeekKey}</p>
 </div>

 {/* ── ACTION ITEMS ── */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
 <Card hover onClick={()=>navigateTo("jobs","Unassigned")} style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.accent}`}}>
 <div style={{fontSize:22,fontWeight:600,color:unassigned>0?T.text:T.textDim}}>{unassigned}</div>
 <div style={{fontSize:10,color:T.textMuted}}>Unassigned</div>
 </Card>
 <Card style={{padding:14,borderLeft:`3px solid ${T.accent}66`}}>
 <div style={{fontSize:22,fontWeight:600,color:T.text}}>{inProgress}</div>
 <div style={{fontSize:10,color:T.textMuted}}>In Progress</div>
 </Card>
 <Card style={{padding:14,borderLeft:`3px solid ${T.accent}44`}}>
 <div style={{fontSize:22,fontWeight:600,color:T.text}}>{pendingRedlines}</div>
 <div style={{fontSize:10,color:T.textMuted}}>Pending Redlines</div>
 </Card>
 <Card hover onClick={()=>navigateTo("tickets")} style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.accent}`}}>
 <div style={{fontSize:22,fontWeight:600,color:openTickets.length>0?T.text:T.textDim}}>{openTickets.length}</div>
 <div style={{fontSize:10,color:T.textMuted}}>Open Tickets</div>
 </Card>
 <Card style={{padding:14,borderLeft:`3px solid ${T.accent}88`}}>
 <div style={{fontSize:22,fontWeight:600,color:T.text}}>{weekFeetTotal>=1000?`${(weekFeetTotal/1000).toFixed(1)}k`:weekFeetTotal}</div>
 <div style={{fontSize:10,color:T.textMuted}}>Feet This Week</div>
 </Card>
 </div>

 {/* ── CREW DEPLOYMENT TABLE ── */}
 <Card style={{padding:0,overflow:"hidden",marginBottom:16}}>
 <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
 <h3 style={{fontSize:14,fontWeight:600,color:T.text,margin:0}}>Crew Deployment</h3>
 <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{linemen.length} crew members · {weekJobsTotal} jobs completed this week</div>
 </div>
 <div style={{overflowX:"auto"}}>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
 <thead><tr style={{background:T.bgInput}}>
 {["Crew Member","Status","Current Job","Truck","This Week","Footage"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 14px",color:T.textMuted,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.4,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>)}
 </tr></thead>
 <tbody>
 {crewStatus.sort((a,b)=>b.weekFeet-a.weekFeet).map(c=>{
 const isActive=!!c.activeJob;
 return <tr key={c.lm.id} style={{borderBottom:`1px solid ${T.border}08`}} className="card-hover">
 <td style={{padding:"10px 14px"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <div style={{width:8,height:8,borderRadius:4,background:isActive?T.success:c.pendingSubmissions>0?T.warning:T.textDim}}/>
 <div><div style={{fontWeight:600,color:T.text}}>{c.lm.name}</div><div style={{fontSize:10,color:T.textDim}}>{c.lm.role}</div></div>
 </div>
 </td>
 <td style={{padding:"10px 14px"}}><Badge label={isActive?"On Job":c.pendingSubmissions>0?"Assigned":"Available"} color={isActive?T.success:c.pendingSubmissions>0?T.warning:T.textDim} bg={(isActive?T.success:c.pendingSubmissions>0?T.warning:T.textDim)+"18"}/></td>
 <td style={{padding:"10px 14px"}}>{c.activeJob?<span style={{fontFamily:"monospace",color:T.accent,fontWeight:600,cursor:"pointer"}} onClick={()=>{setSelectedJob(c.activeJob);setView("job_detail");}}>{c.activeJob.feederId}</span>:<span style={{color:T.textDim}}>—</span>}</td>
 <td style={{padding:"10px 14px",color:T.textMuted}}>{c.truck?c.truck.id:"—"}</td>
 <td style={{padding:"10px 14px"}}><span style={{fontWeight:600,color:T.text}}>{c.completedThisWeek}</span> <span style={{color:T.textDim}}>jobs</span></td>
 <td style={{padding:"10px 14px",fontWeight:600,color:T.text}}>{c.weekFeet>=1000?`${(c.weekFeet/1000).toFixed(1)}k`:c.weekFeet} ft</td>
 </tr>;})}
 </tbody>
 </table>
 </div>
 </Card>

 {/* ── BOTTOM: Recent Production + Tickets + Compliance ── */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
 {/* Recent Production */}
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
 <h3 style={{fontSize:12,fontWeight:600,color:T.text,margin:0}}>Recent Production</h3>
 </div>
 <div style={{maxHeight:220,overflowY:"auto"}}>
 {recentProd.length===0&&<div style={{padding:24,textAlign:"center",fontSize:11,color:T.textDim}}>No recent submissions</div>}
 {recentProd.map(j=>{
 const crew=USERS.find(u=>u.id===j.production.submittedBy);
 const hrs=Math.round((now-new Date(j.production.submittedAt))/3600000);
 const ago=hrs<1?"now":hrs<24?hrs+"h":Math.round(hrs/24)+"d";
 return <div key={j.id} className="card-hover" onClick={()=>{setSelectedJob(j);setView("job_detail");}} style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <span style={{fontSize:11,fontWeight:700,color:T.accent,fontFamily:"monospace"}}>{j.feederId}</span>
 <span style={{fontSize:9,color:T.textDim}}>{ago}</span>
 </div>
 <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>{crew?.name} · {j.production.totalFeet?.toLocaleString()} ft</div>
 </div>;})}
 </div>
 </Card>

 {/* Open Tickets */}
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <h3 style={{fontSize:12,fontWeight:600,color:T.text,margin:0}}>My Tickets</h3>
 <button onClick={()=>navigateTo("tickets")} style={{fontSize:9,color:T.accent,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>All →</button>
 </div>
 <div style={{maxHeight:220,overflowY:"auto"}}>
 {openTickets.length===0&&<div style={{padding:24,textAlign:"center"}}><div style={{fontSize:11,color:T.success,fontWeight:600}}>No open tickets</div></div>}
 {openTickets.slice(0,5).map(t=>{
 const TSC2={Open:{c:T.warning},Acknowledged:{c:T.accent}};const stc=TSC2[t.status]||{c:T.textMuted};
 return <div key={t.id} className="card-hover" onClick={()=>navigateTo("tickets")} style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}08`,cursor:"pointer",borderLeft:`3px solid ${stc.c}`}}>
 <div style={{fontSize:11,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject}</div>
 <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{t.region} · {t.createdBy}</div>
 </div>;})}
 </div>
 </Card>

 {/* Compliance Alerts */}
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
 <h3 style={{fontSize:12,fontWeight:600,color:T.text,margin:0}}>Truck Compliance</h3>
 </div>
 <div style={{maxHeight:220,overflowY:"auto"}}>
 {compAlerts.length===0&&<div style={{padding:24,textAlign:"center"}}><div style={{fontSize:11,color:T.success,fontWeight:600}}>All clear</div><div style={{fontSize:10,color:T.textDim,marginTop:2}}>No compliance issues</div></div>}
 {compAlerts.slice(0,6).map((a,i)=>{
 const isExp=a.status.status==="expired";
 return <div key={i} style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}08`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div><div style={{fontSize:11,fontWeight:600,color:T.text}}>{a.truck.id}</div><div style={{fontSize:10,color:T.textDim}}>{a.type}</div></div>
 <Badge label={a.status.label} color={isExp?T.danger:a.status.color} bg={(isExp?T.danger:a.status.color)+"18"}/>
 </div>;})}
 </div>
 </Card>
 </div>
 </div>;
 }

 // ─── TICKETS VIEW (Admin/Supervisor/Billing/Client Manager) ─────────────
 function TicketsView(){
 const{tickets,setTickets,currentUser,jobs,setView,setSelectedJob,setClientDetailOpen}=useApp();
 const[openId,setOpenId]=useState(null);
 const[reply,setReply]=useState('');
 const[filter,setFilter]=useState('all');
 const[regionFilter,setRegionFilter]=useState('all');
 const[priorityFilter,setPriorityFilter]=useState('all');
 const[showCreate,setShowCreate]=useState(false);
 const[nt,setNt]=useState({subject:'',region:'',customer:'',priority:'normal',message:'',relatedJob:'',assignedTo:''});
 const now=new Date();
 React.useEffect(()=>{if(currentUser.role==="client_manager")setClientDetailOpen(!!openId);return()=>{if(currentUser.role==="client_manager")setClientDetailOpen(false);};},[openId]);
 const TSC={Open:{c:T.warning,bg:T.warningSoft},Acknowledged:{c:T.accent,bg:T.accentSoft},Resolved:{c:T.success,bg:T.successSoft},Rejected:{c:T.danger,bg:T.dangerSoft}};
 const TPC={urgent:{c:T.danger,l:'URGENT'},high:{c:T.warning,l:'HIGH'},normal:{c:T.textMuted,l:'NORMAL'}};
 const isAdm=["admin","supervisor","billing"].includes(currentUser.role);
 const isCM=currentUser.role==="client_manager";
 const assignableUsers=USERS.filter(u=>["admin","supervisor","billing"].includes(u.role));

 const myTickets=tickets.filter(t=>{
 // Admin sees all. Supervisor sees tickets they created, are assigned to, or in their region.
 if(currentUser.role==="admin"||currentUser.role==="billing")return true;
 if(currentUser.role==="supervisor"){
 const scope=currentUser.scope||{};
 return t.createdBy===currentUser.name||t.assignedTo===currentUser.id||(scope.region&&t.region===scope.region);
 }
 if(isCM)return true;
 return t.createdBy===currentUser.name||t.assignedTo===currentUser.id;
 });

 const filtered=myTickets.filter(t=>{
 if(filter==="open")return t.status==="Open";
 if(filter==="acknowledged")return t.status==="Acknowledged";
 if(filter==="resolved")return t.status==="Resolved"||t.status==="Rejected";
 return true;
 }).filter(t=>regionFilter==="all"||t.region===regionFilter)
 .filter(t=>priorityFilter==="all"||t.priority===priorityFilter)
 .sort((a,b)=>{const so={Open:0,Acknowledged:1,Resolved:3,Rejected:4};return(so[a.status]||0)-(so[b.status]||0)||b.createdAt.localeCompare(a.createdAt);});

 const stats={open:myTickets.filter(t=>t.status==="Open").length,ack:myTickets.filter(t=>t.status==="Acknowledged").length,resolved:myTickets.filter(t=>t.status==="Resolved").length,total:myTickets.length};

 const createTicket=()=>{
 if(!nt.subject.trim()||!nt.message.trim()||!nt.region)return;
 const id='TK-'+String(tickets.length+6).padStart(4,'0');
 setTickets(prev=>[{id,subject:nt.subject,region:nt.region,customer:nt.customer||'General',priority:nt.priority,status:'Open',
 createdBy:currentUser.name,createdByRole:currentUser.role,createdAt:now.toISOString(),relatedJob:nt.relatedJob||null,
 assignedTo:nt.assignedTo||currentUser.id,
 messages:[{id:'tm'+Date.now(),from:currentUser.name,role:currentUser.role,text:nt.message,ts:now.toISOString()}]},...prev]);
 setNt({subject:'',region:'',customer:'',priority:'normal',message:'',relatedJob:'',assignedTo:''});setShowCreate(false);
 };
 const addReply=(tid)=>{if(!reply.trim())return;setTickets(prev=>prev.map(t=>t.id===tid?{...t,messages:[...t.messages,{id:'tm'+Date.now(),from:currentUser.name,role:currentUser.role,text:reply,ts:now.toISOString()}]}:t));setReply('');};
 const updateStatus=(tid,ns)=>{setTickets(prev=>prev.map(t=>t.id===tid?{...t,status:ns,messages:[...t.messages,{id:'tms'+Date.now(),from:currentUser.name,role:currentUser.role,text:'Status changed to '+ns,ts:now.toISOString(),isSystem:true}]}:t));};
 const assignTicket=(tid,userId)=>{setTickets(prev=>prev.map(t=>t.id===tid?{...t,assignedTo:userId,messages:[...t.messages,{id:'tma'+Date.now(),from:currentUser.name,role:currentUser.role,text:`Assigned to ${USERS.find(u=>u.id===userId)?.name||userId}`,ts:now.toISOString(),isSystem:true}]}:t));};

 // ── Detail View ──
 if(openId){
 const tk=tickets.find(t=>t.id===openId);
 if(!tk)return null;
 const stc=TSC[tk.status]||{c:T.textMuted,bg:"transparent"};
 const prc=TPC[tk.priority]||TPC.normal;
 const assignee=USERS.find(u=>u.id===tk.assignedTo);
 return <div>
 <button onClick={()=>setOpenId(null)} style={{padding:"6px 14px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:16}}>← All Tickets</button>
 <Card style={{padding:0,overflow:"hidden"}}>
 <div style={{padding:"20px 24px",borderBottom:`1px solid ${T.border}`,borderLeft:`4px solid ${stc.c}`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
 <div style={{flex:1}}>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
 <span style={{fontSize:13,fontWeight:700,color:T.textDim,fontFamily:"monospace"}}>{tk.id}</span>
 <Badge label={tk.status} color={stc.c} bg={stc.bg}/>
 {tk.priority!=="normal"&&<Badge label={prc.l} color={prc.c} bg={prc.c+"18"}/>}
 </div>
 <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{tk.subject}</h2>
 <div style={{fontSize:12,color:T.textMuted,marginTop:6}}>
 <b>{tk.region}</b> · {tk.customer} · Opened by <b>{tk.createdBy}</b> ({tk.createdByRole.replace("_"," ")}) · {fd(tk.createdAt.split("T")[0])}
 {tk.relatedJob&&<span> · Job: <span style={{fontWeight:600,color:T.accent,fontFamily:"monospace",cursor:"pointer"}} onClick={()=>{const j=jobs.find(j=>j.feederId===tk.relatedJob);if(j){setSelectedJob(j);setView("job_detail");}}}>{tk.relatedJob}</span></span>}
 </div>
 {assignee&&<div style={{fontSize:11,color:T.textMuted,marginTop:4}}>Assigned to: <b style={{color:T.accent}}>{assignee.name}</b></div>}
 </div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
 {isAdm&&<select value={tk.assignedTo||""} onChange={e=>assignTicket(tk.id,e.target.value)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:11}}>
 <option value="">Assign to...</option>{assignableUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>}
 {isAdm&&tk.status==="Open"&&<Btn sz="sm" onClick={()=>updateStatus(tk.id,"Acknowledged")} style={{background:T.accent}}>Acknowledge</Btn>}
 {isCM&&tk.status==="Open"&&<Btn sz="sm" onClick={()=>updateStatus(tk.id,"Acknowledged")} style={{background:T.accent}}>Acknowledge</Btn>}
 {(isAdm||isCM)&&(tk.status==="Open"||tk.status==="Acknowledged")&&<Btn sz="sm" onClick={()=>updateStatus(tk.id,"Resolved")} style={{background:T.success}}>Resolve</Btn>}
 {isAdm&&(tk.status==="Resolved"||tk.status==="Rejected")&&<Btn sz="sm" v="ghost" onClick={()=>updateStatus(tk.id,"Open")}>Reopen</Btn>}
 </div>
 </div>
 </div>
 <div style={{padding:"16px 24px",maxHeight:480,overflowY:"auto"}}>
 {tk.messages.map(m=>{
 const isMe=m.from===currentUser.name;
 const roleColor=m.role==="client_manager"?T.purple:m.role==="supervisor"?T.warning:T.accent;
 const roleBg=roleColor+"15";
 const roleLabel=m.role==="client_manager"?"Client":m.role?.replace("_"," ")||"";
 if(m.isSystem)return <div key={m.id} style={{textAlign:"center",padding:"8px 0"}}><span style={{fontSize:11,color:T.textDim,background:T.bgInput,padding:"4px 12px",borderRadius:6}}>{m.from} · {m.text}</span></div>;
 return <div key={m.id} style={{marginBottom:16,display:"flex",flexDirection:isMe?"row-reverse":"row",gap:10}}>
 <div style={{width:32,height:32,borderRadius:"50%",background:roleBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:roleColor,flexShrink:0}}>{m.from.split(" ").map(n=>n[0]).join("")}</div>
 <div style={{maxWidth:"75%"}}>
 <div style={{fontSize:11,color:T.textMuted,marginBottom:3,display:"flex",gap:6,justifyContent:isMe?"flex-end":"flex-start"}}><b>{m.from}</b><span style={{color:T.textDim}}>{roleLabel}</span><span style={{color:T.textDim}}>{new Date(m.ts).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span></div>
 <div style={{padding:"10px 14px",borderRadius:12,background:isMe?roleBg:T.bgInput,color:T.text,fontSize:13,lineHeight:1.6,borderTopRightRadius:isMe?2:12,borderTopLeftRadius:isMe?12:2}}>{m.text}</div>
 </div></div>;
 })}
 </div>
 {tk.status!=="Resolved"&&tk.status!=="Rejected"&&<div style={{padding:"12px 24px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
 <input value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey)addReply(tk.id);}} placeholder="Type a reply..." style={{flex:1,padding:"10px 14px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:13,outline:"none"}}/>
 <Btn onClick={()=>addReply(tk.id)} disabled={!reply.trim()}>Send</Btn>
 </div>}
 </Card>
 </div>;
 }

 // ── List View ──
 return <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
 <div>
 <h1 style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:4}}>Tickets</h1>
 <p style={{color:T.textMuted,fontSize:13,margin:0}}>{stats.open} open · {stats.ack} in progress · {stats.resolved} resolved · {stats.total} total</p>
 </div>
 <Btn onClick={()=>setShowCreate(!showCreate)}>{showCreate?"Cancel":"+ New Ticket"}</Btn>
 </div>

 {/* Summary cards */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
 <Card style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.warning}`}} onClick={()=>setFilter("open")}><div style={{fontSize:24,fontWeight:600,color:T.warning}}>{stats.open}</div><div style={{fontSize:11,color:T.textMuted}}>Open</div></Card>
 <Card style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.accent}`}} onClick={()=>setFilter("acknowledged")}><div style={{fontSize:24,fontWeight:600,color:T.accent}}>{stats.ack}</div><div style={{fontSize:11,color:T.textMuted}}>In Progress</div></Card>
 <Card style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.success}`}} onClick={()=>setFilter("resolved")}><div style={{fontSize:24,fontWeight:600,color:T.success}}>{stats.resolved}</div><div style={{fontSize:11,color:T.textMuted}}>Resolved</div></Card>
 <Card style={{padding:14,cursor:"pointer",borderLeft:`3px solid ${T.textDim}`}} onClick={()=>setFilter("all")}><div style={{fontSize:24,fontWeight:600,color:T.text}}>{stats.total}</div><div style={{fontSize:11,color:T.textMuted}}>Total</div></Card>
 </div>

 {/* Create ticket panel */}
 {showCreate&&<Card style={{marginBottom:16,border:`1px solid ${T.accent}44`,padding:20}}>
 <h3 style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:14}}>Create New Ticket</h3>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
 <div><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.4}}>Region *</label><select value={nt.region} onChange={e=>setNt(p=>({...p,region:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:nt.region?T.text:T.textDim,fontSize:12}}><option value="">Select Region</option>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
 <div><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.4}}>Customer</label><select value={nt.customer} onChange={e=>setNt(p=>({...p,customer:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:nt.customer?T.text:T.textDim,fontSize:12}}><option value="">General</option>{CUSTOMERS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
 </div>
 <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.4}}>Subject *</label><input value={nt.subject} onChange={e=>setNt(p=>({...p,subject:e.target.value}))} placeholder="Brief description of the issue" style={{width:"100%",padding:"9px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:13,boxSizing:"border-box"}}/></div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
 <div><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.4}}>Priority</label><select value={nt.priority} onChange={e=>setNt(p=>({...p,priority:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
 <div><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.4}}>Related Job</label><input value={nt.relatedJob} onChange={e=>setNt(p=>({...p,relatedJob:e.target.value}))} placeholder="e.g. BSPD001.04H" style={{width:"100%",padding:"9px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,boxSizing:"border-box"}}/></div>
 {isAdm&&<div><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.4}}>Assign To</label><select value={nt.assignedTo} onChange={e=>setNt(p=>({...p,assignedTo:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}><option value="">Self</option>{assignableUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
 </div>
 <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.4}}>Description *</label><textarea value={nt.message} onChange={e=>setNt(p=>({...p,message:e.target.value}))} placeholder="Provide details about the issue..." rows={3} style={{width:"100%",padding:"9px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:13,resize:"vertical",boxSizing:"border-box"}}/></div>
 <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
 <Btn v="ghost" onClick={()=>setShowCreate(false)}>Cancel</Btn>
 <Btn onClick={createTicket} disabled={!nt.subject.trim()||!nt.message.trim()||!nt.region}>Create Ticket</Btn>
 </div>
 </Card>}

 {/* Filters */}
 <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
 {[{k:"all",l:"All"},{k:"open",l:"Open"},{k:"acknowledged",l:"In Progress"},{k:"resolved",l:"Resolved"}].map(f=>
 <button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${filter===f.k?T.accent:T.border}`,background:filter===f.k?T.accentSoft:"transparent",color:filter===f.k?T.accent:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{f.l}</button>)}
 <select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12,marginLeft:4}}><option value="all">All Regions</option>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</select>
 <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:T.bgInput,color:T.text,fontSize:12}}><option value="all">All Priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option></select>
 </div>

 {/* Ticket list */}
 {filtered.length===0&&<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:16,fontWeight:600,color:T.textDim}}>No tickets match your filters</div></Card>}
 {filtered.map(t=>{
 const stc=TSC[t.status]||{c:T.textMuted,bg:"transparent"};
 const prc=TPC[t.priority]||TPC.normal;
 const lastMsg=t.messages[t.messages.length-1];
 const hrs=Math.round((now-new Date(lastMsg.ts))/3600000);
 const ago=hrs<1?"just now":hrs<24?hrs+"h ago":Math.round(hrs/24)+"d ago";
 const assignee=USERS.find(u=>u.id===t.assignedTo);
 return <Card key={t.id} hover onClick={()=>setOpenId(t.id)} style={{marginBottom:8,padding:0,overflow:"hidden",cursor:"pointer",borderLeft:`3px solid ${stc.c}`}}>
 <div style={{padding:"14px 18px"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
 <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
 <span style={{fontSize:11,fontWeight:700,color:T.textDim,fontFamily:"monospace",flexShrink:0}}>{t.id}</span>
 <span style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject}</span>
 </div>
 <div style={{display:"flex",gap:4,flexShrink:0}}>
 {t.priority!=="normal"&&<Badge label={prc.l} color={prc.c} bg={prc.c+"18"}/>}
 <Badge label={t.status} color={stc.c} bg={stc.bg}/>
 </div>
 </div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{fontSize:11,color:T.textMuted}}>
 <span style={{color:T.accent,fontWeight:600}}>{t.region}</span> · {t.createdBy}
 {assignee&&<span> · <span style={{color:T.purple,fontWeight:600}}>{assignee.name}</span></span>}
 {t.relatedJob&&<span> · <span style={{fontFamily:"monospace",color:T.accent}}>{t.relatedJob}</span></span>}
 · {t.messages.length} msg{t.messages.length!==1?"s":""}
 </div>
 <span style={{fontSize:11,color:T.textDim}}>{ago}</span>
 </div>
 <div style={{fontSize:12,color:T.textDim,marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{lastMsg.text.slice(0,120)}{lastMsg.text.length>120?"...":""}"</div>
 </div>
 </Card>;
 })}
 </div>;
 }

 const render=()=>{
 if(view==="job_detail"&&selectedJob)return <JobDetail/>;
 if(view==="investor_dashboard")return <InvestorDashboard/>;
 if(view==="investor_stubs")return <InvestorStubsView/>;
 if(view==="trucks")return <TrucksView/>;
 if(view==="drills")return <DrillsView/>;
 if(view==="drill_investor_dashboard")return <DrillInvestorDashboard/>;
 if(view==="drill_investor_stubs")return <DrillInvestorStubsView/>;
 if(view==="truck_health")return <TruckHealthView/>;
 if(view==="drill_health")return <DrillHealthView/>;
 if(view==="foreman_stubs")return <ForemanStubsView/>;
 if(view==="supervisor_stubs")return <SupervisorStubsView/>;
 if(view==="jobs")return <JobsMgmt/>;
 if(view==="ratecards")return <RateCardsView/>;
 if(view==="invoicing")return <InvoicingView/>;
 if(view==="reports")return <ReportsView/>;
 if(view==="payroll")return <PayrollView/>;
 if(view==="paystubs")return <PayStubsView/>;
 if(view==="users")return <UsersView/>;
 if(view==="settings")return <SettingsView/>;
 if(view==="client_portal")return <ClientPortal/>;
 if(view==="crew_visibility")return <CrewVisibilityView/>;
 if(view==="redline_review")return <RedlineReviewView/>;
 if(view==="client_jobs")return <ClientJobsView/>;
 if(view==="client_subs")return <ClientSubsView/>;
 if(view==="map_cutter")return <MapCutterView/>;
 if(view==="compliance")return <ComplianceView/>;
 if(view==="splicing")return <SplicingView/>;
 if(view==="materials")return <MaterialsView/>;
 if(view==="dispatch")return <ScheduleView/>;
 if(view==="tickets")return <TicketsView/>;
 if(view==="supervisor_dashboard")return <SupervisorDashboard/>;
 if(view==="my_schedule")return <MyScheduleView/>;
 return <Dashboard/>;
 };

 // ─── MOBILE FIELD MODE ─────────────────────────────────────────────────────

 const isFieldRole=currentUser.role==="lineman"||currentUser.role==="foreman";

 return <Ctx.Provider value={ctx}>
 <style>{`
 @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
 *{margin:0;padding:0;box-sizing:border-box;font-family:'Instrument Sans','DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
 body{background:${T.bg};color:${T.text};overflow-x:hidden;transition:background 0.2s,color 0.2s;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
 ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}::-webkit-scrollbar-thumb:hover{background:${T.textDim};}
 select option{background:${T.bgCard};color:${T.text};}
 input::placeholder,textarea::placeholder{color:${T.textDim};opacity:0.7;}
 .card-hover{cursor:pointer;transition:all 0.15s ease;}.card-hover:hover{background:${T.bgCardHover} !important;border-color:${T.accent}18 !important;}
 @keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
 @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
 @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
 @keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
 @media(max-width:767px){body{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%;}table{font-size:12px;}td,th{padding:8px 6px !important;}div::-webkit-scrollbar{display:none;}}
 `}</style>
 <><Sidebar view={view} setView={v=>{setNavFrom(null);setJobsPreFilter("");setClientDetailOpen(false);setView(v);if(isMobile)setSidebarOpen(false);}} currentUser={currentUser} onSwitch={onSwitch} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} isMobile={isMobile}/>
 <main style={{marginLeft:isMobile?0:56,padding:isMobile?"16px 12px":"24px 28px",paddingTop:isMobile?60:24,minHeight:"100vh",position:"relative"}}>
 {/* ── MOBILE HEADER BAR ── */}
 {isMobile&&<div style={{position:"fixed",top:0,left:0,right:0,height:52,background:T.bgCard,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",zIndex:90,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
  <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{width:36,height:36,borderRadius:8,background:"transparent",border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>
  <div style={{fontSize:13,fontWeight:700,color:T.text,letterSpacing:1}}><span>FIBER</span><span style={{fontWeight:400,color:T.textMuted}}>LYTIC</span></div>
  <div style={{width:36}}/>
 </div>}
 {/* ── NOTIFICATION BELL ── */}
 <div style={{position:"fixed",top:isMobile?8:14,right:isMobile?52:20,zIndex:900,display:"flex",alignItems:"center",gap:8}}>
  <button onClick={()=>{setNotifOpen(!notifOpen);if(!notifOpen)markAllRead();}} style={{position:"relative",width:36,height:36,borderRadius:8,background:notifOpen?T.accent:T.bgCard,border:`1px solid ${notifOpen?T.accent:T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={notifOpen?"#fff":T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
   {unreadCount>0&&<div style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,background:T.danger,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",boxShadow:"0 1px 3px rgba(0,0,0,0.3)",animation:unreadCount>5?"pulse 2s infinite":"none"}}>{unreadCount>99?"99+":unreadCount}</div>}
  </button>
 </div>
 {/* ── NOTIFICATION PANEL ── */}
 {notifOpen&&<div style={{position:"fixed",top:56,right:isMobile?8:16,width:isMobile?"calc(100vw - 16px)":380,maxHeight:"75vh",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:901,display:"flex",flexDirection:"column",overflow:"hidden",animation:"fadeIn 0.15s ease"}}>
  <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
   <div><div style={{fontSize:14,fontWeight:700,color:T.text}}>Notifications</div><div style={{fontSize:11,color:T.textMuted}}>{myNotifs.length} alert{myNotifs.length!==1?"s":""}{myNotifs.filter(n=>n.severity==="critical").length>0&&<span style={{color:T.danger,fontWeight:600}}> · {myNotifs.filter(n=>n.severity==="critical").length} critical</span>}</div></div>
   <div style={{display:"flex",gap:6}}>{myNotifs.length>0&&<button onClick={dismissAll} style={{padding:"4px 10px",borderRadius:4,fontSize:10,fontWeight:600,background:T.bgInput,border:`1px solid ${T.border}`,color:T.textMuted,cursor:"pointer"}}>Clear all</button>}<button onClick={()=>setNotifOpen(false)} style={{width:26,height:26,borderRadius:4,background:T.bgInput,border:`1px solid ${T.border}`,color:T.textMuted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>
  </div>
  <div style={{overflowY:"auto",flex:1}}>
   {myNotifs.length===0&&<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>&#10003;</div><div style={{fontSize:13,color:T.textMuted}}>All clear — no alerts</div></div>}
   {["critical","warning","info"].map(sev=>{const items=myNotifs.filter(n=>n.severity===sev);if(items.length===0)return null;const sevCfg={critical:{label:"CRITICAL",c:T.danger,bg:T.dangerSoft},warning:{label:"ATTENTION",c:T.warning,bg:T.warningSoft},info:{label:"INFO",c:T.accent,bg:T.accentSoft}}[sev];
   return <div key={sev}>
    <div style={{padding:"6px 16px",background:sevCfg.bg,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:3,background:sevCfg.c}}/><span style={{fontSize:10,fontWeight:700,color:sevCfg.c,letterSpacing:0.5}}>{sevCfg.label} ({items.length})</span></div>
    {items.map(n=>{const isRead=readNotifs[n.id];return <div key={n.id} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"flex-start",background:isRead?"transparent":sevCfg.bg+"44",transition:"all 0.15s",cursor:"pointer"}} onClick={()=>{setReadNotifs(p=>({...p,[n.id]:true}));if(n.cat==="compliance")setView("compliance");else if(n.cat==="materials")setView("materials");else if(n.cat==="jobs"&&n.icon==="jobs")setView("jobs");else if(n.cat==="tickets")setView("tickets");else if(n.cat==="billing")setView("invoicing");setNotifOpen(false);}}>
     <div style={{width:28,height:28,borderRadius:6,background:sevCfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={sevCfg.c} strokeWidth="2">{n.severity==="critical"?<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>:n.severity==="warning"?<path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>}</svg></div>
     <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:isRead?500:700,color:T.text,lineHeight:1.3}}>{n.title}</div><div style={{fontSize:11,color:T.textMuted,marginTop:2,lineHeight:1.3}}>{n.body}</div><div style={{display:"flex",gap:8,marginTop:4}}><span style={{fontSize:9,color:T.textDim,padding:"1px 6px",borderRadius:3,background:T.bgInput,textTransform:"uppercase",fontWeight:600,letterSpacing:0.3}}>{n.cat}</span></div></div>
     <button onClick={(e)=>{e.stopPropagation();dismissNotif(n.id);}} title="Dismiss" style={{width:20,height:20,borderRadius:4,background:"transparent",border:"none",color:T.textDim,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:0.6}}>×</button>
    </div>;})}
   </div>;})}
  </div>
 </div>}
 {notifOpen&&<div onClick={()=>setNotifOpen(false)} style={{position:"fixed",inset:0,zIndex:899}}/>}
 {navFrom&&view!=="job_detail"&&<button onClick={()=>{setView(navFrom.view);setNavFrom(null);setJobsPreFilter("");}} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:12,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background=T.bgInput;e.currentTarget.style.color=T.text;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.textMuted;}}>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg>
 Back to {navFrom.label}
 </button>}
 {currentUser.role==="client_manager"&&!clientDetailOpen&&["client_portal","crew_visibility","redline_review","client_jobs","tickets"].includes(view)&&(()=>{
 const scope=currentUser.scope||{};
 const scopeFilter=(j)=>j.client===scope.client&&(!scope.customer||j.customer===scope.customer)&&(!scope.regions||scope.regions.includes(j.region));
 const allJobs=jobs.filter(scopeFilter);
 const subs=["NextGen Fiber","Illuminate"];
 const current=clientSubFilter==="all"?null:clientSubFilter;
 const currentJobs=current?allJobs.filter(j=>j.subcontractor===current):allJobs;
 const activeCount=currentJobs.filter(j=>j.status==="Assigned"||j.status==="Unassigned").length;
 const completedCount=currentJobs.filter(j=>j.production).length;
 return <div style={{marginBottom:16}}>
  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",background:current?`linear-gradient(135deg, ${T.bgCard}, ${T.accent}08)`:T.bgCard,borderRadius:8,border:`1px solid ${current?T.accent+"44":T.border}`}}>
  {/* Current context indicator */}
  <div style={{width:36,height:36,borderRadius:6,background:current?T.accent:T.bgInput,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
   <span style={{fontSize:current?16:14,color:current?"#fff":T.textMuted}}>{current?current.charAt(0):"ALL"}</span>
  </div>
  <div style={{flex:1,minWidth:0}}>
   <div style={{fontSize:14,fontWeight:700,color:T.text}}>{current||"All Subcontractors"}</div>
   <div style={{fontSize:11,color:T.textMuted}}>{currentJobs.length} jobs · {completedCount} completed · {activeCount} active</div>
  </div>
  {/* Switcher dropdown */}
  <div style={{display:"flex",gap:4,alignItems:"center"}}>
   <button onClick={()=>setClientSubFilter("all")} style={{padding:"6px 12px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:clientSubFilter==="all"?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:clientSubFilter==="all"?T.accentSoft:"transparent",color:clientSubFilter==="all"?T.accent:T.textMuted,transition:"all 0.12s"}}>All</button>
   {subs.map(s=>{const isActive=clientSubFilter===s;const count=allJobs.filter(j=>j.subcontractor===s).length;
   return <button key={s} onClick={()=>setClientSubFilter(clientSubFilter===s?"all":s)} style={{padding:"6px 12px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:isActive?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:isActive?T.accentSoft:"transparent",color:isActive?T.accent:T.textMuted,transition:"all 0.12s",display:"flex",alignItems:"center",gap:5}}>
    <span style={{width:6,height:6,borderRadius:3,background:isActive?T.accent:T.textDim,flexShrink:0}}/>
    {s} <span style={{opacity:0.5,fontSize:10}}>({count})</span>
   </button>;
   })}
  </div>
  </div>
 </div>;
 })()}
 {render()}
 </main></>
 </Ctx.Provider>;
}
