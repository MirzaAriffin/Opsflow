import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin, CheckCircle2, AlertCircle, ChevronLeft,
  LogIn, LogOut, Check, Plus, Fuel, Camera, ClipboardList,
  Lock, ShieldAlert, KeyRound, Users, AlertTriangle, Truck, Building2,
  Clock, TrendingUp, Calendar, Waves, Droplet, FileClock, XCircle,
  MessageSquare, Edit3, UserPlus, Trash2, Pencil, CalendarDays, BedDouble,
  Download, Archive, RotateCcw, Search, Wifi, WifiOff, Settings
} from "lucide-react";
import { db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, writeBatch, query, orderBy, serverTimestamp
} from "firebase/firestore";

// ── Brand palette ────────────────────────────────────────────────────
const BLUE = "#2F4E8C";
const BLUE_DARK = "#1F3766";
const BLUE_DARKER = "#13243F";
const BLUE_LIGHT = "#EAF0FB";
const BLUE_MID = "#5B7FBD";
const AMBER = "#B45309";
const AMBER_DARK = "#92400E";
const AMBER_LIGHT = "#FEF3E2";
const RED = "#B42318";
const RED_LIGHT = "#FEF1F0";
const GREEN = "#1D9E75";
const GREEN_DARK = "#0F6E56";
const GREEN_LIGHT = "#E8F7F1";
const PURPLE = "#6941C6";
const PURPLE_LIGHT = "#F4F0FE";
const INK = "#111827";
const SLATE = "#6B7280";
const SLATE_LIGHT = "#9CA3AF";
const BORDER = "#E5E7EB";
const CANVAS = "#F6F7FB";

const TANKER_VEHICLES = ["Small Tanker GBJ5093Y", "Small Tanker GBG1311K", "Big Tanker YQ2857X", "Big Tanker YN2464L", "Others"];
const TANKER_SERVICING = ["Grease Separator/Interceptor", "Ejector Tanks", "Sump Pits", "Stormwater/Detention Tanks", "Others"];
const TANKER_LEVELS = ["B4", "B3", "B2", "B1", "L1", "L2", "L3", "L4", "L5"];
const FREQUENCY = ["Weekly", "Fortnightly", "Monthly", "Bi-Monthly", "Quarterly", "Yearly", "Ad-hoc/One-off"];
const JETTING_VEHICLES = ["Jetting Truck GBP4471M", "Jetting Truck GBQ8820T", "Others"];
const JETTING_SERVICING = ["HPWJ Flushing of KWP", "HPWJ Flushing of SWP", "Electro-Mechanical Rodding", "Clearing of Choke", "Others"];
const WATERTANK_VEHICLES = ["Others"];
const WATERTANK_SERVICING = ["Tank Cleaning", "Tank Inspection", "Water Quality Check", "Others"];
const FUEL_COMPANIES = ["Caltex", "Esso", "Vegatron", "Others"];

// ── Leave board ───────────────────────────────────────────────────────
const LEAVE_TYPES = [
  { key:"mc",       label:"Medical Leave (MC)",  color:RED,      bg:RED_LIGHT,    emoji:"🏥" },
  { key:"al",       label:"Annual Leave",         color:GREEN,    bg:GREEN_LIGHT,  emoji:"🌴" },
  { key:"overseas", label:"Overseas",             color:BLUE,     bg:BLUE_LIGHT,   emoji:"✈️" },
  { key:"unpaid",   label:"Unpaid Leave",         color:AMBER,    bg:AMBER_LIGHT,  emoji:"💸" },
  { key:"off",      label:"Off-in-lieu",          color:PURPLE,   bg:PURPLE_LIGHT, emoji:"🔄" },
  { key:"training", label:"Training / Course",    color:"#0E7490",bg:"#F0FDFF",    emoji:"📚" },
  { key:"other",    label:"Others",               color:SLATE,    bg:CANVAS,       emoji:"📋" },
];
function leaveTypeInfo(key) { return LEAVE_TYPES.find(t=>t.key===key)||LEAVE_TYPES[LEAVE_TYPES.length-1]; }

function sgToday() { return new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Singapore"}); }
function dateInLeave(d,e) { return d>=e.startDate&&d<=e.endDate; }
function isLeaveActiveToday(e) { return dateInLeave(sgToday(),e); }
function leaveDayCount(s,e) { const ms=86400000,a=new Date(`${s}T00:00:00`),b=new Date(`${e}T00:00:00`); return Math.max(1,Math.round((b-a)/ms)+1); }
function formatLeaveDate(d) { return new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"}); }
const emptyLeaveDraft = () => ({type:null,startDate:"",endDate:"",note:""});

// ── User directory ───────────────────────────────────────────────────
const USERS_DEFAULT = [
  {name:"Master Admin",role:"admin",team:null,pin:"A4827"},
  {name:"Mirza",role:"supervisor",team:null,pin:"S2916",supervisorTeams:["tanker"]},
  {name:"Haris",role:"supervisor",team:null,pin:"S7053",supervisorTeams:["jetting"]},
  {name:"Ilyas",role:"supervisor",team:null,pin:"S1489",supervisorTeams:["watertank"]},
  {name:"Kassim",role:"supervisor",team:null,pin:"S6204",supervisorTeams:["tanker","jetting","watertank"]},
  {name:"Fariz",role:"worker",team:"watertank",pin:"WT3175"},
  {name:"Arumugam",role:"worker",team:"tanker",pin:"T7563"},
  {name:"Haizad",role:"worker",team:"tanker",pin:"T5840"},
  {name:"Islam",role:"worker",team:"tanker",pin:"T2671"},
  {name:"Muthu",role:"worker",team:"tanker",pin:"T9038"},
  {name:"Raj",role:"worker",team:"tanker",pin:"T4192"},
  {name:"Afiq Kamaruzaman",role:"worker",team:"jetting",pin:"J1758"},
  {name:"Afiq Roslan",role:"worker",team:"jetting",pin:"J5042"},
  {name:"Gopi",role:"worker",team:"jetting",pin:"J0863"},
  {name:"Murugesan",role:"worker",team:"jetting",pin:"J4715"},
  {name:"Neppo",role:"worker",team:"jetting",pin:"J9427"},
  {name:"Noor",role:"worker",team:"jetting",pin:"J8214"},
  {name:"Vasu",role:"worker",team:"jetting",pin:"J6390"},
  {name:"Wang",role:"worker",team:"jetting",pin:"J3697"},
];
const BETA_TEST_USER = {name:"Beta Tester",role:"beta",team:null,pin:"B0000"};
const CASUAL_LABOUR_OPTION = "Casual labour (type name)";

function sortedWorkers(team,dir=USERS_DEFAULT) {
  return dir.filter(u=>u.role==="worker"&&u.team===team).map(u=>u.name).sort((a,b)=>a.localeCompare(b));
}
function allSupervisors(dir=USERS_DEFAULT) {
  // Every supervisor is selectable as personnel on any team's job — same principle as
  // "helping from another team" for workers. supervisorTeams only controls dashboard/admin
  // scoping (which teams they monitor), not who can be picked as crew on a job.
  return dir.filter(u=>u.role==="supervisor").map(u=>u.name).sort((a,b)=>a.localeCompare(b));
}
function buildTeamWorkerOptions(team,dir=USERS_DEFAULT) {
  const own = sortedWorkers(team,dir);
  const supervisors = allSupervisors(dir);
  const otherTeams = ["tanker","jetting","watertank"].filter(t=>t!==team);
  // "Other" = workers from other teams only (not their supervisors — supervisors get their own
  // dedicated group above, and are always shown regardless of which team they manage).
  const otherRaw = otherTeams.flatMap(t=>sortedWorkers(t,dir));
  const other = [...new Set(otherRaw)].filter(name=>!own.includes(name));
  return {own,supervisors,other,flat:[...own,...supervisors,...other,CASUAL_LABOUR_OPTION]};
}
function teamWorkerOptions(team,dir=USERS_DEFAULT) { return buildTeamWorkerOptions(team,dir); }
function isJettingVehicle(label) { return label&&label.startsWith("Jetting Truck"); }
function findUserByPin(pin,dir) { if(pin===BETA_TEST_USER.pin)return BETA_TEST_USER; return dir.find(u=>u.pin===pin)||null; }

function useElapsed(startTime) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
  if(!startTime)return "0m";
  const totalMin=Math.floor((now-startTime)/60000),h=Math.floor(totalMin/60),m=totalMin%60;
  return h>0?`${h}h ${m}m`:`${m}m`;
}

// ── Singapore public holidays ────────────────────────────────────────
const SG_PUBLIC_HOLIDAYS_BY_YEAR = {
  2026:["2026-01-01","2026-01-28","2026-01-29","2026-03-20","2026-04-03","2026-05-01","2026-05-27","2026-05-31","2026-08-09","2026-11-08","2026-12-25"],
  2027:["2027-01-01","2027-02-06","2027-02-07","2027-03-10","2027-03-26","2027-05-01","2027-05-17","2027-05-20","2027-08-09","2027-10-28","2027-12-25"],
};
function buildObservedHolidays(dates) { const s=new Set(dates); dates.forEach(d=>{const dt=new Date(`${d}T12:00:00+08:00`);if(dt.getUTCDay()===0){const mon=new Date(dt.getTime()+86400000);s.add(mon.toLocaleDateString("en-CA",{timeZone:"Asia/Singapore"}));}}); return s; }
const SG_OBSERVED={};
Object.entries(SG_PUBLIC_HOLIDAYS_BY_YEAR).forEach(([y,dates])=>{SG_OBSERVED[y]=buildObservedHolidays(dates);});
function sgDateParts(ts) { const d=new Date(ts).toLocaleDateString("en-CA",{timeZone:"Asia/Singapore"}); return {dateStr:d,weekday:new Date(`${d}T12:00:00+08:00`).getUTCDay()}; }
function getDayType(ts) { const {dateStr,weekday}=sgDateParts(ts),year=dateStr.slice(0,4),obs=SG_OBSERVED[year]; if(obs&&obs.has(dateStr))return"Public Holiday"; if(weekday===0)return"Sunday"; if(weekday===6)return"Saturday"; return"Weekday"; }
function isPremiumDay(dt) { return dt==="Sunday"||dt==="Public Holiday"; }
function roundOT(v) { return Math.round(v*10)/10; }
function calcOT(cin,cout) { const dt=getDayType(cin),hrs=(cout-cin)/3600000; if(isPremiumDay(dt))return roundOT(hrs); const {dateStr}=sgDateParts(cin),isSat=dt==="Saturday",endH=isSat?12:17,dayEnd=new Date(`${dateStr}T${String(endH).padStart(2,"0")}:30:00+08:00`).getTime(),dayStart=new Date(`${dateStr}T08:30:00+08:00`).getTime(); let ot=0; if(cin<dayStart)ot+=Math.min(cout,dayStart)-cin; if(cout>dayEnd)ot+=cout-Math.max(cin,dayEnd); return roundOT(Math.max(0,ot)/3600000); }

// ── Per-person job credit ─────────────────────────────────────────────
// Every person on a job (checker + crew) individually earns the job's full hours and OT.
// "Team total OT" = sum of every individual's OT credit, i.e. headcount × per-job OT.
function jobCreditedPeople(job) {
  const people = new Set();
  if (job.checker) people.add(job.checker);
  (job.crew || []).forEach((name) => { if (name) people.add(name); });
  return [...people];
}

// Sum hours/OT credited to ONE specific person across a list of jobs (their personal total).
function personTotals(jobs, personName) {
  return jobs.reduce((acc, j) => {
    if (jobCreditedPeople(j).includes(personName)) {
      acc.hours += parseFloat(j.hours || 0);
      acc.ot += calcOT(j.checkInTime, j.checkOutTime);
      acc.jobCount += 1;
    }
    return acc;
  }, { hours: 0, ot: 0, jobCount: 0 });
}

// Sum hours/OT across ALL people on ALL jobs (team/aggregate total — payroll view).
// Each person on each job counts separately: 2 people on a 1hr-OT job = 2hrs team OT.
function teamTotals(jobs) {
  return jobs.reduce((acc, j) => {
    const headcount = jobCreditedPeople(j).length || 1;
    acc.hours += parseFloat(j.hours || 0) * headcount;
    acc.ot += calcOT(j.checkInTime, j.checkOutTime) * headcount;
    return acc;
  }, { hours: 0, ot: 0 });
}

function canSeeOT(session,ownerName) { return session.role==="admin"||session.role==="supervisor"||session.role==="beta"||session.name===ownerName; }

// Distance traveled since the PREVIOUS fill-up for the SAME vehicle (not the same person —
// any driver's fill-up counts toward the vehicle's running total). Returns null if there's
// no valid prior reading to compare against (first ever fill-up, or missing/invalid odometer data).
function mileageDeltaFor(fillUp, allFuelHistory) {
  if (!fillUp || !fillUp.vehicle) return null;
  const sameVehicle = allFuelHistory.filter(f => f.vehicle === fillUp.vehicle).sort((a,b) => a.date - b.date);
  const idx = sameVehicle.findIndex(f => f.id === fillUp.id);
  if (idx <= 0) return null; // first fill-up for this vehicle, or not found — nothing to compare against
  const curM = parseFloat(fillUp.mileage);
  const prevM = parseFloat(sameVehicle[idx - 1].mileage);
  if (isNaN(curM) || isNaN(prevM)) return null;
  const delta = curM - prevM;
  return delta >= 0 ? delta : null; // negative delta means bad data entry (odometer rollback) — don't show a misleading number
}

// ── Empty drafts ─────────────────────────────────────────────────────
const emptyDraft = ()=>({team:null,checker:null,gpsCaptured:false,manualCheckIn:"",vehicles:[],crewByVehicle:{},crewCustomNames:{},vehicleCustomPlates:{}});
const emptyCheckout = ()=>({serviceLines:[{type:"",qty:"",freq:"",levels:[],detail:""}],jobsheet:"",pubDisposal:"",remarks:"",manualCheckOut:""});
const emptyFuelDraft = ()=>({team:null,person:null,vehicle:null,company:null,companyCustom:"",amount:"",price:"",mileage:"",mileageAux:"",tank:null});
const emptyFiledDraft = ()=>({team:null,manualCheckIn:"",manualCheckOut:"",vehicles:[],crewByVehicle:{},crewCustomNames:{},vehicleCustomPlates:{},jobSite:"",serviceLines:[{type:"",qty:"",freq:"",levels:[],detail:""}],jobsheet:"",pubDisposal:"",remarks:"",reason:""});

// ── Firestore collection refs ─────────────────────────────────────────
const COL = {
  jobs:       "jobs",
  fuel:       "fuel",
  activeJobs: "activeJobs",
  filed:      "filed",
  leave:      "leave",
  archives:   "archives",
  settings:   "settings",
  users:      "users",
  vehicles:   "vehicles",
};

// ── useFireCollection: real-time listener for a collection ────────────
function useFireCollection(colName, fallback = []) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, colName), (snap) => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error(colName, err); setLoading(false); });
    return unsub;
  }, [colName]);
  return [data, loading];
}

// ── useFireDoc: real-time listener for a single document ──────────────
function useFireDoc(colName, docId, fallback = null) {
  const [data, setData] = useState(fallback);
  useEffect(() => {
    if (!docId) return;
    const unsub = onSnapshot(doc(db, colName, docId), (snap) => {
      setData(snap.exists() ? { id: snap.id, ...snap.data() } : fallback);
    });
    return unsub;
  }, [colName, docId]);
  return data;
}

// ── Firestore write helpers ───────────────────────────────────────────
async function fsAdd(colName, data) {
  const ref = await addDoc(collection(db, colName), { ...data, _createdAt: Date.now() });
  return ref.id;
}
async function fsSet(colName, docId, data) {
  await setDoc(doc(db, colName, docId), { ...data, _updatedAt: Date.now() }, { merge: true });
}
async function fsUpdate(colName, docId, data) {
  await updateDoc(doc(db, colName, docId), { ...data, _updatedAt: Date.now() });
}
async function fsDelete(colName, docId) {
  await deleteDoc(doc(db, colName, docId));
}
async function fsDeleteCollection(colName) {
  const snap = await getDocs(collection(db, colName));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}
async function fsDeleteWhere(colName, field, value) {
  const snap = await getDocs(collection(db, colName));
  const batch = writeBatch(db);
  snap.docs.filter(d => d.data()[field] === value).forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// Rename a person across every historical record that references their name.
// This does NOT touch archives (frozen point-in-time snapshots — renaming the live
// person shouldn't silently rewrite a permanent archived record of the past).
async function fsRenamePerson(oldName, newName) {
  // jobs: checker (string), crew (array)
  {
    const snap = await getDocs(collection(db, COL.jobs));
    const batch = writeBatch(db);
    let touched = false;
    snap.docs.forEach(d => {
      const data = d.data();
      const update = {};
      if (data.checker === oldName) update.checker = newName;
      if (Array.isArray(data.crew) && data.crew.includes(oldName)) update.crew = data.crew.map(n => n === oldName ? newName : n);
      if (data.approvedBy === oldName) update.approvedBy = newName;
      if (data.lastEditedBy === oldName) update.lastEditedBy = newName;
      if (data.filedBy === oldName) update.filedBy = newName;
      if (Object.keys(update).length) { batch.update(d.ref, update); touched = true; }
    });
    if (touched) await batch.commit();
  }
  // fuel: person (string)
  {
    const snap = await getDocs(collection(db, COL.fuel));
    const batch = writeBatch(db);
    let touched = false;
    snap.docs.forEach(d => {
      if (d.data().person === oldName) { batch.update(d.ref, { person: newName }); touched = true; }
    });
    if (touched) await batch.commit();
  }
  // filed: checker, crew[], filedBy, approvedBy
  {
    const snap = await getDocs(collection(db, COL.filed));
    const batch = writeBatch(db);
    let touched = false;
    snap.docs.forEach(d => {
      const data = d.data();
      const update = {};
      if (data.checker === oldName) update.checker = newName;
      if (Array.isArray(data.crew) && data.crew.includes(oldName)) update.crew = data.crew.map(n => n === oldName ? newName : n);
      if (data.filedBy === oldName) update.filedBy = newName;
      if (data.approvedBy === oldName) update.approvedBy = newName;
      if (Object.keys(update).length) { batch.update(d.ref, update); touched = true; }
    });
    if (touched) await batch.commit();
  }
  // leave: name, postedBy
  {
    const snap = await getDocs(collection(db, COL.leave));
    const batch = writeBatch(db);
    let touched = false;
    snap.docs.forEach(d => {
      const data = d.data();
      const update = {};
      if (data.name === oldName) update.name = newName;
      if (data.postedBy === oldName) update.postedBy = newName;
      if (Object.keys(update).length) { batch.update(d.ref, update); touched = true; }
    });
    if (touched) await batch.commit();
  }
  // settings: supervisorTeamPrefs keyed by name, removedUsers array of names
  {
    const settingsSnap = await getDoc(doc(db, COL.settings, "config"));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      const update = {};
      if (data.supervisorTeamPrefs && data.supervisorTeamPrefs[oldName]) {
        const nextPrefs = { ...data.supervisorTeamPrefs };
        nextPrefs[newName] = nextPrefs[oldName];
        delete nextPrefs[oldName];
        update.supervisorTeamPrefs = nextPrefs;
      }
      if (Array.isArray(data.removedUsers) && data.removedUsers.includes(oldName)) {
        update.removedUsers = data.removedUsers.map(n => n === oldName ? newName : n);
      }
      if (Object.keys(update).length) await fsSet(COL.settings, "config", { ...data, ...update });
    }
  }
  // users: move the user doc itself from oldName -> newName (doc ID is the name)
  {
    const oldSnap = await getDoc(doc(db, COL.users, oldName));
    if (oldSnap.exists()) {
      const userData = oldSnap.data();
      await setDoc(doc(db, COL.users, newName), { ...userData, name: newName });
      await deleteDoc(doc(db, COL.users, oldName));
    }
  }
}

// ── localStorage (session-local only) ────────────────────────────────
function lsGet(key,fb){try{const r=localStorage.getItem(key);return r===null?fb:JSON.parse(r);}catch{return fb;}}
function lsSet(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch{}}
function usePersisted(key,initial){const[state,setRaw]=useState(()=>lsGet(key,typeof initial==="function"?initial():initial));const setState=useCallback(val=>{setRaw(prev=>{const next=typeof val==="function"?val(prev):val;lsSet(key,next);return next;});},[key]);return[state,setState];}

function Header({ title, onBack, accent }) {
  const c = accent || BLUE;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18, paddingTop:4 }}>
      {onBack && (
        <button onClick={onBack} style={{ width:42, height:42, borderRadius:12, border:`1px solid ${BORDER}`, background:"white", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, boxShadow:"0 1px 3px rgba(16,24,40,0.06)", WebkitTapHighlightColor:"transparent" }}>
          <ChevronLeft size={22} color={c} />
        </button>
      )}
      <div style={{ fontSize:17, fontWeight:700, color:INK, letterSpacing:-0.2 }}>{title}</div>
    </div>
  );
}

function ProgressDots({ step, total, accent }) {
  return (
    <div style={{ display:"flex", gap:5, marginBottom:20 }}>
      {Array.from({ length: total }).map((_,i) => (
        <div key={i} style={{ height:4, borderRadius:2, flex:1, background: i <= step ? (accent||BLUE) : BORDER, transition:"background 0.2s" }} />
      ))}
    </div>
  );
}

function PickList({ options, selected, multi, onToggle, label, accent }) {
  const c = accent || BLUE;
  return (
    <>
      <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>{label}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
        {options.map((opt) => {
          const isSel = multi ? selected.includes(opt) : selected === opt;
          return (
            <button key={opt} onClick={() => onToggle(opt)} style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px", borderRadius:12, border: isSel ? `1.5px solid ${c}` : `1px solid ${BORDER}`, background: isSel ? `${c}12` : "white", textAlign:"left", cursor:"pointer", fontSize:14, color:INK, boxShadow: isSel ? `0 2px 8px ${c}1a` : "0 1px 2px rgba(16,24,40,0.03)", transition:"all 0.15s" }}>
              <span style={{ width:19, height:19, borderRadius: multi ? 5 : "50%", border:`1.5px solid ${isSel ? c : "#D1D5DB"}`, background: isSel ? c : "transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {isSel && <Check size={12} color="white" strokeWidth={3} />}
              </span>
              <span style={{ flex:1, fontWeight: isSel ? 600 : 400 }}>{opt}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const inputStyle = {
  width:"100%", padding:"13px 14px", borderRadius:12, border:`1px solid ${BORDER}`,
  fontSize:14, color:INK, background:"white", marginBottom:14, boxSizing:"border-box",
  fontFamily:"inherit", outline:"none",
};

// datetime-local's native picker UI can ignore width:100% on some Android/Chrome
// versions, overflowing the parent. minWidth:0 lets the box-model constraint actually
// win over the input's intrinsic content width; maxWidth keeps it pinned regardless.
const datetimeInputStyle = {
  ...inputStyle,
  minWidth: 0,
  maxWidth: "100%",
};

function PrimaryButton({ children, onClick, disabled, accent }) {
  const c = accent || BLUE;
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:"100%", padding:15, borderRadius:12, border:"none", background: disabled ? "#F0F1F4" : c, color: disabled ? "#B0B4BC" : "white", fontSize:15, fontWeight:800, cursor: disabled ? "not-allowed" : "pointer", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow: disabled ? "none" : `0 4px 14px ${c}33`, transition:"all 0.15s" }}>
      {children}
    </button>
  );
}

function ChipGroup({ options, value, multi, onPick, accent }) {
  const c = accent || BLUE;
  const isSelected = (opt) => multi ? (Array.isArray(value) ? value.includes(opt) : false) : value === opt;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
      {options.map((opt) => {
        const sel = isSelected(opt);
        return (
          <button key={opt} onClick={() => onPick(opt)} style={{ padding:"7px 13px", borderRadius:20, border: sel ? `1.5px solid ${c}` : `1px solid ${BORDER}`, background: sel ? c : "white", color: sel ? "white" : INK, fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
            {sel && <Check size={11} strokeWidth={3} />}{opt}
          </button>
        );
      })}
    </div>
  );
}

function ReviewBlock({ rows }) {
  return (
    <div style={{ border:`1px solid ${BORDER}`, borderRadius:14, overflow:"hidden", marginBottom:20, background:"white" }}>
      {rows.map(([label, val], i) => (
        <div key={i} style={{ display:"flex", gap:12, padding:"11px 14px", borderBottom: i < rows.length-1 ? `1px solid ${BORDER}` : "none" }}>
          <span style={{ fontSize:12, color:SLATE, fontWeight:600, flexShrink:0, minWidth:110 }}>{label}</span>
          <span style={{ fontSize:12.5, color:INK, fontWeight:500 }}>{val || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function TeamIcon({ team, size=20, color }) {
  const c = color || teamAccent(team);
  if (team === "tanker") return <Truck size={size} color={c} />;
  if (team === "jetting") return <Waves size={size} color={c} />;
  if (team === "watertank") return <Droplet size={size} color={c} />;
  return <Building2 size={size} color={c} />;
}

function teamAccent(team) {
  if (team === "tanker") return BLUE;
  if (team === "jetting") return GREEN;
  if (team === "watertank") return "#0E7490";
  return BLUE;
}

function teamLabel(team) {
  if (team === "tanker") return "Tanker";
  if (team === "jetting") return "Jetting";
  if (team === "watertank") return "Water Tank";
  return team || "Unknown";
}

function teamVehicles(team) {
  if (team === "jetting") return JETTING_VEHICLES;
  if (team === "watertank") return WATERTANK_VEHICLES;
  return TANKER_VEHICLES;
}

function teamServicing(team) {
  if (team === "jetting") return JETTING_SERVICING;
  if (team === "watertank") return WATERTANK_SERVICING;
  return TANKER_SERVICING;
}

const pillStyle = { fontSize:11, fontWeight:600, padding:"4px 9px", borderRadius:7, background:"rgba(255,255,255,0.18)" };

// Lightweight global "is a Firestore write in flight" flag, readable by Shell from any of the
// ~49 screen call sites without prop-drilling or needing a Context Provider wrapping the tree
// (which isn't feasible here since screens are early-returned, not nested children).
let globalSyncingState = false;
const syncingListeners = new Set();
function setGlobalSyncing(val) {
  globalSyncingState = val;
  syncingListeners.forEach(fn => fn(val));
}
function useSyncingIndicator() {
  const [syncing, setSyncing] = useState(globalSyncingState);
  useEffect(() => {
    syncingListeners.add(setSyncing);
    return () => syncingListeners.delete(setSyncing);
  }, []);
  return syncing;
}

// Pull-to-refresh: since Firestore data is already live (onSnapshot keeps everything current),
// there's nothing to actually re-fetch — this is a physical confirmation gesture for the user
// ("yes, the app is responsive and your data is current"), not a real network refetch.
// overscroll-behavior:none is already set globally in index.html, so the browser's own
// native bounce/refresh is suppressed, leaving a clean gesture surface for this.
const PULL_THRESHOLD = 70;
function usePullToRefresh(containerRef) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshed, setRefreshed] = useState(false);
  const touchStartY = useRef(null);
  const isPulling = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (window.scrollY <= 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };
    const onTouchMove = (e) => {
      if (!isPulling.current || touchStartY.current === null) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0 && window.scrollY <= 0) {
        setPullDistance(Math.min(delta * 0.5, 100)); // damped, capped so it never feels like the screen is being yanked off
      } else {
        isPulling.current = false;
        setPullDistance(0);
      }
    };
    const onTouchEnd = () => {
      if (isPulling.current && pullDistance >= PULL_THRESHOLD) {
        setRefreshed(true);
        setTimeout(() => setRefreshed(false), 1200);
      }
      isPulling.current = false;
      touchStartY.current = null;
      setPullDistance(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef, pullDistance]);

  return { pullDistance, refreshed, isReady: pullDistance >= PULL_THRESHOLD };
}

function Shell({ children }) {
  const syncing = useSyncingIndicator();
  const shellRef = useRef(null);
  const { pullDistance, refreshed, isReady } = usePullToRefresh(shellRef);
  // With apple-mobile-web-app-status-bar-style set to "default" (in index.html), iOS reserves
  // real, solid space for the status bar instead of letting content draw underneath it — so we
  // no longer need to fight for safe-area clearance with a tall fallback. A small top padding
  // plus env(safe-area-inset-top) (mainly relevant for the bottom home-indicator bar and any
  // landscape/notch edge cases) is enough now that the platform handles the main overlap itself.
  const safeTop = "calc(env(safe-area-inset-top, 0px) + 12px)";
  const safeBottom = "calc(env(safe-area-inset-bottom, 0px) + 16px)";
  return (
    <div ref={shellRef} style={{ minHeight:"100vh", background:CANVAS, fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display:"flex", justifyContent:"center", paddingTop:safeTop, paddingBottom:safeBottom, paddingLeft:"env(safe-area-inset-left, 0px)", paddingRight:"env(safe-area-inset-right, 0px)" }}>
      <div style={{ width:"100%", maxWidth:420, padding:"16px 16px 40px", position:"relative", transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : "none", transition: pullDistance === 0 ? "transform 0.25s ease-out" : "none" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        {(pullDistance > 0 || refreshed) && (
          <div style={{ position:"absolute", top:-46, left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"center", gap:6, opacity: refreshed ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1) }}>
            {refreshed ? (
              <>
                <CheckCircle2 size={14} color={GREEN_DARK} />
                <span style={{ fontSize:11.5, fontWeight:600, color:GREEN_DARK }}>Up to date</span>
              </>
            ) : (
              <>
                <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${BORDER}`, borderTop:`2px solid ${isReady?BLUE:SLATE_LIGHT}`, transform:`rotate(${pullDistance*3}deg)` }} />
                <span style={{ fontSize:11.5, fontWeight:600, color: isReady ? BLUE : SLATE_LIGHT }}>{isReady ? "Release to refresh" : "Pull to refresh"}</span>
              </>
            )}
          </div>
        )}
        {syncing && (
          <div style={{ position:"fixed", top:`calc(${safeTop} + 10px)`, left:"50%", transform:"translateX(-50%)", zIndex:9998, display:"flex", alignItems:"center", gap:7, background:"rgba(17,24,39,0.88)", backdropFilter:"blur(4px)", color:"white", fontSize:11.5, fontWeight:600, padding:"7px 14px", borderRadius:20, boxShadow:"0 4px 14px rgba(17,24,39,0.25)" }}>
            <div style={{ width:11, height:11, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.3)", borderTop:"2px solid white", animation:"spin 0.7s linear infinite" }} />
            Saving…
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children, accent }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:11 }}>
      <div style={{ width:3, height:13, borderRadius:2, background: accent || SLATE_LIGHT }} />
      <div style={{ fontSize:11, fontWeight:800, color:SLATE, textTransform:"uppercase", letterSpacing:0.7 }}>{children}</div>
    </div>
  );
}

function tileStyle() {
  return { width:"100%", display:"flex", alignItems:"center", gap:14, padding:18, borderRadius:16, border:`1px solid ${BORDER}`, background:"white", marginBottom:10, cursor:"pointer", textAlign:"left", boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 1px 6px rgba(16,24,40,0.03)" };
}
const tileIconStyle = { width:46, height:46, borderRadius:13, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };
const tileTitleStyle = { display:"block", fontSize:15, fontWeight:700, color:INK };
const tileSubStyle = { display:"block", fontSize:12, color:SLATE, marginTop:1 };

// ── Seed data (only used on first load if localStorage is empty) ─────
function seedJobHistory() {
  const day = 86400000, now = Date.now();
  return [
    { id:"seed-j1", team:"tanker", checker:"Haizad", jobSite:"Tampines Mall — Grease Trap B1", checkInTime:now-2*day-3.5*3600000, checkOutTime:now-2*day, vehicles:["Big Tanker YQ2857X"], crew:["Haizad","Islam"] },
    { id:"seed-j2", team:"tanker", checker:"Haizad", jobSite:"Jurong Point — Ejector Tank L2", checkInTime:now-5*day-4.2*3600000, checkOutTime:now-5*day, vehicles:["Small Tanker GBJ5093Y"], crew:["Haizad"] },
    { id:"seed-j3", team:"jetting", checker:"Noor", jobSite:"Changi Airport T1 — Drain Choke", checkInTime:now-1*day-5.8*3600000, checkOutTime:now-1*day, vehicles:["Jetting Truck GBP4471M"], crew:["Noor","Wang"] },
    { id:"seed-j4", team:"jetting", checker:"Vasu", jobSite:"One-North — HPWJ Flushing", checkInTime:now-4*day-3.1*3600000, checkOutTime:now-4*day, vehicles:["Jetting Truck GBQ8820T"], crew:["Vasu"] },
  ].map((j) => ({ ...j, hours:((j.checkOutTime-j.checkInTime)/3600000).toFixed(2) }));
}

function seedFuelHistory() {
  const day = 86400000, now = Date.now();
  return [
    { id:"seed-f1", team:"tanker", person:"Haizad", vehicle:"Big Tanker YQ2857X", company:"Shell", amount:"62.4", price:"128.10", mileage:"84210", mileageAux:"", tank:null, date:now-2*day },
    { id:"seed-f2", team:"tanker", person:"Islam", vehicle:"Small Tanker GBJ5093Y", company:"Esso", amount:"38.0", price:"78.20", mileage:"51022", mileageAux:"", tank:null, date:now-6*day },
    { id:"seed-f3", team:"jetting", person:"Noor", vehicle:"Jetting Truck GBP4471M", company:"SPC", amount:"70.5", price:"146.90", mileage:"29110", mileageAux:"412", tank:"both", date:now-1*day },
    { id:"seed-f4", team:"jetting", person:"Wang", vehicle:"Jetting Truck GBQ8820T", company:"Shell", amount:"45.2", price:"94.30", mileage:"17880", mileageAux:"", tank:"main", date:now-3*day },
  ];
}

// ── Filed entry status components ─────────────────────────────────────
function FiledTabs({ entries, active, onChange }) {
  const counts = { pending:0, approved:0, rejected:0 };
  entries.forEach((e) => { if (counts[e.status] !== undefined) counts[e.status]++; });
  return (
    <div style={{ display:"flex", gap:6, marginBottom:18 }}>
      {["pending","approved","rejected"].map((tab) => {
        const colors = { pending:{ bg:"#FEF0E6", color:"#C2570C", border:"#C2570C" }, approved:{ bg:GREEN_LIGHT, color:GREEN_DARK, border:GREEN_DARK }, rejected:{ bg:RED_LIGHT, color:RED, border:RED } };
        const c = colors[tab];
        const isActive = active === tab;
        return (
          <button key={tab} onClick={() => onChange(tab)} style={{ flex:1, padding:"8px 6px", borderRadius:10, border:`1.5px solid ${isActive ? c.border : BORDER}`, background: isActive ? c.bg : "white", cursor:"pointer" }}>
            <div style={{ fontSize:13, fontWeight:800, color: isActive ? c.color : SLATE }}>{counts[tab]}</div>
            <div style={{ fontSize:10, fontWeight:700, color: isActive ? c.color : SLATE_LIGHT, textTransform:"uppercase", letterSpacing:0.3 }}>{tab}</div>
          </button>
        );
      })}
    </div>
  );
}

function FiledStatusCard({ entry: e, isReviewer, onApprove, onReject, onUndo, onWithdraw, onAmend }) {
  const [expanded, setExpanded] = React.useState(isReviewer); // auto-expand for reviewers
  const accent = { pending:"#C2570C", approved:GREEN_DARK, rejected:RED }[e.status] || SLATE;
  const bg = { pending:"#FEF0E6", approved:GREEN_LIGHT, rejected:RED_LIGHT }[e.status] || CANVAS;
  const hoursNum = parseFloat(e.hours || 0);
  const ot = e.checkInTime && e.checkOutTime ? calcOT(e.checkInTime, e.checkOutTime) : 0;
  const dayType = e.checkInTime ? getDayType(e.checkInTime) : null;
  const premium = dayType ? isPremiumDay(dayType) : false;
  const serviceSummary = (e.serviceLines || []).map((l) =>
    `${l.type}${l.qty ? ` ×${l.qty}` : ""}${l.freq ? ` (${l.freq})` : ""}${l.levels?.length ? ` [${l.levels.join(",")}]` : ""}${l.detail ? ` — ${l.detail}` : ""}`
  );
  return (
    <div style={{ border:`1.5px solid ${accent}44`, borderRadius:14, marginBottom:12, overflow:"hidden", background:"white" }}>
      {/* Status header */}
      <div style={{ background:bg, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, fontWeight:800, color:accent, textTransform:"uppercase", letterSpacing:0.4 }}>
          {e.status === "pending" ? "⏳ Pending review" : e.status === "approved" ? "✅ Approved" : "❌ Rejected"}
        </span>
        <span style={{ fontSize:11, color:SLATE_LIGHT }}>{teamLabel(e.team)}</span>
      </div>

      {/* Core info — always visible */}
      <div style={{ padding:"12px 14px" }}>
        <div style={{ fontSize:14.5, fontWeight:700, color:INK, marginBottom:3 }}>{e.jobSite}</div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6 }}>
          For <strong>{(e.crew?.length ? e.crew : [e.checker]).join(", ")}</strong>
          {e.filedBy && e.filedBy !== e.checker && <> · filed by {e.filedBy}</>}
          {e.checkInTime && e.checkOutTime && (
            <> · {new Date(e.checkInTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"})}
            {" · "}{new Date(e.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})} – {new Date(e.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}</>
          )}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
          {hoursNum > 0 && <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>{hoursNum.toFixed(1)} hrs</span>}
          {ot > 0 && <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:6, background:premium?RED_LIGHT:GREEN_LIGHT, color:premium?RED:GREEN_DARK }}>{ot.toFixed(1)} OT{premium?" (2×)":""}</span>}
          {dayType && <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:premium?RED:SLATE }}>{dayType}</span>}
        </div>

        {/* Expandable full details */}
        <button onClick={()=>setExpanded(!expanded)} style={{ background:"none", border:"none", color:BLUE, fontSize:12, fontWeight:600, cursor:"pointer", padding:"4px 0", marginBottom: expanded ? 10 : 0 }}>
          {expanded ? "▲ Hide details" : "▼ Show full details"}
        </button>

        {expanded && (
          <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:10, marginTop:2 }}>
            {/* Reason */}
            {e.reason && (
              <div style={{ background:"#FEF0E6", borderRadius:8, padding:"8px 11px", marginBottom:10, fontSize:12, color:"#7C3D08" }}>
                <strong>Reason filed:</strong> {e.reason}
              </div>
            )}

            {/* Vehicles — crew already shown in the always-visible summary above, no need to repeat it here */}
            {e.vehicles?.length > 0 && (
              <div style={{ marginBottom:10, fontSize:11, color:SLATE }}>
                <strong>Vehicles:</strong> {e.vehicles.join(", ")}
              </div>
            )}

            {/* Services */}
            {serviceSummary.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:5, textTransform:"uppercase", letterSpacing:0.3 }}>Services</div>
                {serviceSummary.map((s,i) => (
                  <div key={i} style={{ fontSize:12, color:INK, padding:"5px 0", borderBottom: i < serviceSummary.length-1 ? `1px solid ${CANVAS}` : "none" }}>• {s}</div>
                ))}
              </div>
            )}

            {/* Jobsheet / PUB */}
            {(e.jobsheet || e.pubDisposal) && (
              <div style={{ marginBottom:10 }}>
                {e.jobsheet && <div style={{ fontSize:11, color:SLATE, marginBottom:3 }}><strong>Jobsheet:</strong> {e.jobsheet}</div>}
                {e.pubDisposal && <div style={{ fontSize:11, color:SLATE }}><strong>PUB disposal:</strong> {e.pubDisposal}</div>}
              </div>
            )}

            {/* Remarks */}
            {e.remarks && (
              <div style={{ fontSize:11, color:SLATE, marginBottom:10, fontStyle:"italic" }}>Remarks: "{e.remarks}"</div>
            )}
          </div>
        )}

        {/* Status messages */}
        {e.status === "rejected" && e.rejectionNote && (
          <div style={{ background:RED_LIGHT, borderRadius:9, padding:"9px 11px", marginBottom:8, fontSize:12, color:RED }}>
            <strong>Rejected:</strong> {e.rejectionNote}
          </div>
        )}
        {e.status === "approved" && e.approvedBy && (
          <div style={{ fontSize:11, color:GREEN_DARK, fontWeight:600, marginBottom:6 }}>Approved by {e.approvedBy}</div>
        )}

        {/* Action buttons */}
        {isReviewer ? (
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            {e.status === "pending" && (
              <>
                <button onClick={() => onApprove(e)} style={{ flex:1, padding:10, borderRadius:9, border:"none", background:GREEN_DARK, color:"white", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>✓ Approve</button>
                <button onClick={() => onReject(e)} style={{ flex:1, padding:10, borderRadius:9, border:`1px solid ${RED}`, background:"white", color:RED, fontSize:12.5, fontWeight:700, cursor:"pointer" }}>✕ Reject</button>
              </>
            )}
            {(e.status === "approved" || e.status === "rejected") && (
              <button onClick={() => onUndo(e)} style={{ flex:1, padding:10, borderRadius:9, border:`1px solid ${SLATE}`, background:"white", color:SLATE, fontSize:12.5, fontWeight:700, cursor:"pointer" }}>↩ Undo</button>
            )}
          </div>
        ) : (
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            {e.status === "pending" && <button onClick={() => onWithdraw(e)} style={{ flex:1, padding:10, borderRadius:9, border:`1px solid ${SLATE}`, background:"white", color:SLATE, fontSize:12.5, fontWeight:600, cursor:"pointer" }}>Withdraw</button>}
            {e.status === "rejected" && <button onClick={() => onAmend(e)} style={{ flex:1, padding:10, borderRadius:9, border:"none", background:AMBER, color:"white", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>✏ Amend & Resubmit</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function FuelStatusCard({ lastFillUp, fuelHistory }) {
  if (!lastFillUp) return (
    <div style={{ border:`1px solid ${BORDER}`, borderRadius:13, padding:"11px 14px", marginBottom:12, background:"white", display:"flex", alignItems:"center", gap:8 }}>
      <Fuel size={13} color={SLATE_LIGHT} />
      <span style={{ fontSize:12, color:SLATE_LIGHT }}>No fill-ups logged yet</span>
    </div>
  );
  const daysAgo = Math.floor((Date.now()-lastFillUp.date)/86400000);
  const whenLabel = daysAgo===0?"today":daysAgo===1?"yesterday":`${daysAgo}d ago`;
  const cpl = lastFillUp.amount && lastFillUp.price && parseFloat(lastFillUp.amount) > 0
    ? (parseFloat(lastFillUp.price)/parseFloat(lastFillUp.amount)).toFixed(3) : null;
  const delta = mileageDeltaFor(lastFillUp, fuelHistory || []);
  return (
    <div style={{ border:`1px solid ${BORDER}`, borderRadius:13, background:"white", marginBottom:12, padding:"11px 14px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <Fuel size={12} color={AMBER_DARK} />
          <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:0.4, color:AMBER_DARK, textTransform:"uppercase" }}>Last fill-up · {whenLabel}</span>
        </div>
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:INK, marginBottom:2 }}>{lastFillUp.vehicle}</div>
      <div style={{ fontSize:11, color:SLATE, marginBottom:8 }}>
        {lastFillUp.person} · {lastFillUp.company}
        {cpl && ` · S$${cpl}/L`}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        <span style={{ fontSize:10.5, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>{parseFloat(lastFillUp.amount).toFixed(1)} L</span>
        <span style={{ fontSize:10.5, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>S${parseFloat(lastFillUp.price).toFixed(2)}</span>
        {lastFillUp.mileage && <span style={{ fontSize:10.5, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>{lastFillUp.mileage} km</span>}
        {delta !== null && <span style={{ fontSize:10.5, fontWeight:600, padding:"3px 8px", borderRadius:6, background:BLUE_LIGHT, color:BLUE_DARK }}>+{delta.toFixed(0)} km since last</span>}
      </div>
    </div>
  );
}

// ── Job detail dropdown ──────────────────────────────────────────────
function JobDetailDropdown({ job: j }) {
  const [open, setOpen] = useState(false);
  if (!j.jobsheet && !j.pubDisposal && !j.remarks && !(j.serviceLines?.length)) return null;
  return (
    <div style={{ marginTop:10 }}>
      <button onClick={() => setOpen(!open)} style={{ background:"none", border:"none", color:BLUE, fontSize:12, fontWeight:600, cursor:"pointer", padding:0 }}>
        {open ? "▲ Hide details" : "▼ Show job details"}
      </button>
      {open && (
        <div style={{ marginTop:8, fontSize:12, color:SLATE, lineHeight:1.7 }}>
          {j.jobsheet && <div><strong>Jobsheet:</strong> {j.jobsheet}</div>}
          {j.pubDisposal && <div><strong>PUB disposal:</strong> {j.pubDisposal}</div>}
          {j.remarks && <div><strong>Remarks:</strong> {j.remarks}</div>}
          {j.serviceLines?.length > 0 && (
            <div><strong>Services:</strong> {j.serviceLines.map((l,i) => (
              <span key={i}>{l.type}{l.qty?` ×${l.qty}`:""}{l.freq?` (${l.freq})`:""}{l.detail?` — ${l.detail}`:""}{i<j.serviceLines.length-1?"; ":""}</span>
            ))}</div>
          )}
          {j.lastEditedBy && <div style={{ color:SLATE_LIGHT, fontStyle:"italic", marginTop:4 }}>Edited by {j.lastEditedBy}</div>}
        </div>
      )}
    </div>
  );
}

// ── Team last-job card for dashboard ─────────────────────────────────
function TeamLastJobCard({ team, jobHistory, filedEntries, onClick }) {
  const accent = teamAccent(team);
  const lastJob = [...jobHistory].filter((j) => j.team === team).sort((a,b) => b.checkOutTime - a.checkOutTime)[0];
  // Pending count intentionally not shown here — already surfaced on the "Review filed entries" tile, avoids duplicate badges on the dashboard.

  return (
    <button onClick={onClick} style={{ width:"100%", display:"flex", flexDirection:"column", gap:0, borderRadius:14, border:`1px solid ${accent}33`, background:`${accent}08`, marginBottom:10, cursor:"pointer", textAlign:"left", overflow:"hidden" }}>
      <div style={{ padding:"10px 14px", borderBottom:`1px solid ${accent}22`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <TeamIcon team={team} size={16} color={accent} />
          <span style={{ fontSize:13, fontWeight:700, color:accent }}>{teamLabel(team)} team</span>
        </div>
      </div>
      {lastJob ? (
        <div style={{ padding:"10px 14px" }}>
          <div style={{ fontSize:13, fontWeight:600, color:lastJob.jobSite?INK:SLATE_LIGHT, marginBottom:2, fontStyle:lastJob.jobSite?"normal":"italic" }}>{lastJob.jobSite||"No site recorded"}</div>
          <div style={{ fontSize:11, color:SLATE, marginBottom:8 }}>
            {new Date(lastJob.checkOutTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"})}
            {" · "}{new Date(lastJob.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
            {" – "}{new Date(lastJob.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
            {" · "}{lastJob.hours} hrs
          </div>
          {lastJob.serviceLines?.length > 0 && (
            <div style={{ background:`${accent}10`, borderRadius:8, padding:"7px 10px", marginBottom:8, fontSize:11, color:"#374151", lineHeight:1.6 }}>
              {lastJob.serviceLines.map((l,i) => (
                <div key={i}>• {l.type}{l.qty ? ` ×${l.qty}` : ""}{l.freq ? ` (${l.freq})` : ""}{l.detail ? ` — ${l.detail}` : ""}</div>
              ))}
            </div>
          )}
          {lastJob.crew?.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom: lastJob.remarks ? 8 : 0 }}>
              {lastJob.crew.map((name) => (
                <span key={name} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10.5, fontWeight:600, padding:"2px 8px", borderRadius:6, background:"white", color:"#374151", border:`1px solid ${BORDER}` }}><Users size={10} color="#6B7280" />{name}</span>
              ))}
            </div>
          )}
          {lastJob.remarks && (
            <div style={{ fontSize:11, color:SLATE, fontStyle:"italic" }}>Remarks: "{lastJob.remarks}"</div>
          )}
        </div>
      ) : (
        <div style={{ padding:"10px 14px", fontSize:12, color:SLATE_LIGHT }}>No jobs logged yet</div>
      )}
    </button>
  );
}

// ── Team last-fuel card for supervisor/admin dashboard ─────────────────
// Compact by design (per design feedback) — fuel fill-ups are frequent and lower-stakes
// than a completed job, so this should never visually compete with TeamLastJobCard above it.
function TeamLastFuelCard({ team, fuelHistory, onClick }) {
  const accent = teamAccent(team);
  const teamFuel = fuelHistory.filter((f) => f.team === team);
  const lastFillUp = [...teamFuel].sort((a,b) => b.date - a.date)[0];
  const delta = lastFillUp ? mileageDeltaFor(lastFillUp, fuelHistory) : null;

  return (
    <button onClick={onClick} style={{ width:"100%", display:"flex", flexDirection:"column", gap:0, borderRadius:12, border:`1px solid ${accent}33`, background:`${accent}06`, marginBottom:8, cursor:"pointer", textAlign:"left", overflow:"hidden" }}>
      <div style={{ padding:"7px 12px", borderBottom:`1px solid ${accent}1f`, display:"flex", alignItems:"center", gap:7 }}>
        <TeamIcon team={team} size={13} color={accent} />
        <span style={{ fontSize:11.5, fontWeight:700, color:accent }}>{teamLabel(team)} team</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px" }}>
        <div style={{ width:30, height:30, borderRadius:8, background:AMBER_LIGHT, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Fuel size={13} color={AMBER_DARK} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          {lastFillUp ? (
            <>
              <div style={{ fontSize:12.5, fontWeight:700, color:INK, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{lastFillUp.vehicle}</div>
              <div style={{ fontSize:11, color:SLATE }}>
                {lastFillUp.person} · {new Date(lastFillUp.date).toLocaleDateString("en-SG",{day:"2-digit",month:"short"})}
                {delta !== null && ` · +${delta.toFixed(0)} km`}
              </div>
            </>
          ) : (
            <div style={{ fontSize:12, color:SLATE_LIGHT }}>No fill-ups logged yet</div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Offline banner ────────────────────────────────────────────────────
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1C1C1E", borderRadius:10, padding:"10px 13px", marginBottom:14, fontSize:12, color:"white" }}>
      <WifiOff size={14} />
      <span>You're offline — data is saved locally and will sync when reconnected.</span>
    </div>
  );
}

// ── Logout confirmation modal ────────────────────────────────────────
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(17,24,39,0.55)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:20 }}>
      <div style={{ background:"white", borderRadius:22, padding:"28px 24px 24px", maxWidth:340, width:"100%", textAlign:"center", boxShadow:"0 24px 60px rgba(17,24,39,0.25)" }}>
        <div style={{ width:56, height:56, borderRadius:16, background:`${SLATE}14`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <LogOut size={26} color={SLATE} />
        </div>
        <div style={{ fontSize:16.5, fontWeight:700, color:INK, marginBottom:8, letterSpacing:-0.2 }}>Log out?</div>
        <div style={{ fontSize:13, color:SLATE, marginBottom:22, lineHeight:1.55 }}>Your data is saved. You'll need your PIN to log back in.</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:13, borderRadius:12, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:14, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, padding:13, borderRadius:12, border:"none", background:RED, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 12px ${RED}40` }}>Log out</button>
        </div>
      </div>
    </div>
  );
}

// Generic confirmation modal — used for ANY destructive action (remove user, revoke,
// reset archive, delete logs, etc). Every deletion/reset in the app must route through this.
function ConfirmModal({ title, body, confirmLabel = "Confirm", confirmColor = RED, icon: Icon = AlertTriangle, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(17,24,39,0.55)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:20 }}>
      <div style={{ background:"white", borderRadius:22, padding:"28px 24px 24px", maxWidth:360, width:"100%", textAlign:"center", boxShadow:"0 24px 60px rgba(17,24,39,0.25)" }}>
        <div style={{ width:56, height:56, borderRadius:16, background:`${confirmColor}14`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <Icon size={26} color={confirmColor} />
        </div>
        <div style={{ fontSize:16.5, fontWeight:700, color:INK, marginBottom:8, letterSpacing:-0.2 }}>{title}</div>
        <div style={{ fontSize:13, color:SLATE, marginBottom:22, lineHeight:1.55 }}>{body}</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:13, borderRadius:12, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:14, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, padding:13, borderRadius:12, border:"none", background:confirmColor, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 12px ${confirmColor}40` }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function AppHeader({ session, onLogout }) {
  const roleLabel = session.role==="admin"?"Admin":session.role==="supervisor"?"Supervisor":session.role==="beta"?"Beta Tester":`${teamLabel(session.team)} Team`;
  const initials = session.name.split(" ").map((w)=>w[0]).slice(0,2).join("").toUpperCase();
  const roleAccent = session.role==="admin"?PURPLE:session.role==="supervisor"?AMBER:session.role==="beta"?"#A78BFA":teamAccent(session.team);
  const [showLogout, setShowLogout] = useState(false);
  return (
    <>
      {showLogout && <LogoutModal onConfirm={() => { setShowLogout(false); onLogout(); }} onCancel={() => setShowLogout(false)} />}
      <div style={{ borderRadius:20, padding:"22px 18px 16px", marginBottom:16, background:`linear-gradient(135deg, ${BLUE_DARKER} 0%, ${BLUE_DARK} 55%, ${BLUE} 100%)`, boxShadow:`0 12px 32px ${BLUE_DARKER}45`, position:"relative", overflow:"hidden" }}>
        {/* Decorative circles */}
        <div style={{ position:"absolute", top:-44, right:-44, width:150, height:150, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />
        <div style={{ position:"absolute", bottom:-34, left:-22, width:110, height:110, borderRadius:"50%", background:"rgba(255,255,255,0.03)" }} />
        {/* Centred wordmark */}
        <div style={{ textAlign:"center", marginBottom:17, position:"relative" }}>
          <div style={{ fontSize:27, fontWeight:900, color:"white", letterSpacing:-0.7, lineHeight:1 }}>OPSFLOW</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:600, letterSpacing:0.7, marginTop:4 }}>AIMFLOW PTE LTD · FIELD OPERATIONS</div>
        </div>
        {/* User row */}
        <div style={{ display:"flex", alignItems:"center", gap:11, position:"relative", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"11px 13px" }}>
          <div style={{ width:38, height:38, borderRadius:11, background:`linear-gradient(135deg, ${roleAccent}, ${roleAccent}99)`, padding:1.5, flexShrink:0 }}>
            <div style={{ width:"100%", height:"100%", borderRadius:9.5, background:BLUE_DARKER, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12.5, fontWeight:800, color:"white" }}>{initials}</div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"white", lineHeight:1.2 }}>{session.name}</div>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:roleAccent }} />
              <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.65)", fontWeight:600 }}>{roleLabel}</span>
            </div>
          </div>
          <button onClick={() => setShowLogout(true)} style={{ display:"flex", alignItems:"center", gap:5, border:"1px solid rgba(255,255,255,0.18)", background:"rgba(255,255,255,0.06)", borderRadius:10, padding:"8px 12px", cursor:"pointer", fontSize:11, fontWeight:600, color:"white", flexShrink:0 }}>
            <LogOut size={12} /> Log out
          </button>
        </div>
      </div>
    </>
  );
}

// ── Login screen ─────────────────────────────────────────────────────
function LoginScreen({ onLogin, userDirectory }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [failCount, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setTick((t)=>t+1), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = lockedUntil && Date.now() < lockedUntil;
  const lockSecondsLeft = isLocked ? Math.ceil((lockedUntil-Date.now())/1000) : 0;

  const handleSubmit = () => {
    if (isLocked) return;
    const user = findUserByPin(pin.toUpperCase(), userDirectory);
    if (user) { setFailCount(0); onLogin(user); return; }
    const next = failCount+1;
    setFailCount(next);
    setPin("");
    if (next >= 5) {
      setLockedUntil(Date.now()+5*60000);
      setError("Too many incorrect attempts. Locked for 5 minutes.");
    } else {
      setError(`Incorrect PIN. ${5-next} attempt${5-next===1?"":"s"} left before lockout.`);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", justifyContent:"center", alignItems:"center", padding:"24px 16px", background:`radial-gradient(circle at 20% 10%, ${BLUE_MID}33, transparent 45%), radial-gradient(circle at 85% 90%, ${AMBER}22, transparent 40%), linear-gradient(160deg, ${BLUE_DARKER} 0%, ${BLUE_DARK} 55%, #0B1830 100%)`, fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:30 }}>
          <div style={{ width:64, height:64, borderRadius:18, margin:"0 auto 18px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 24px rgba(0,0,0,0.25)" }}>
            <Building2 size={28} color="white" />
          </div>
          <div style={{ fontSize:34, fontWeight:900, color:"white", letterSpacing:-0.8, lineHeight:1, marginBottom:6 }}>Opsflow</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", fontWeight:600, letterSpacing:0.6, textTransform:"uppercase" }}>Aimflow Pte Ltd · Field Operations</div>
        </div>
        <div style={{ background:"white", borderRadius:22, padding:"26px 22px", boxShadow:"0 24px 60px rgba(0,0,0,0.35)" }}>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:15, fontWeight:700, color:INK, marginBottom:3 }}>Welcome back</div>
            <div style={{ fontSize:12.5, color:SLATE }}>Enter your PIN to continue</div>
          </div>
          <input id="pin-input" name="pin" autoComplete="off" autoFocus value={pin} disabled={isLocked} onChange={(e)=>{setError(null);setPin(e.target.value.toUpperCase().slice(0,8));}} onKeyDown={(e)=>{if(e.key==="Enter")handleSubmit();}} placeholder="PIN" style={{ width:"100%", textAlign:"center", letterSpacing:6, fontSize:22, fontWeight:800, color:BLUE_DARK, padding:"16px 12px", borderRadius:13, border:`1.5px solid ${pin?BLUE:BORDER}`, background:pin?BLUE_LIGHT:CANVAS, marginBottom:16, boxSizing:"border-box", textTransform:"uppercase", transition:"all 0.15s" }} />
          {isLocked && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><Lock size={16} style={{ flexShrink:0, marginTop:1 }} /><span>Locked. Try again in {Math.floor(lockSecondsLeft/60)}:{String(lockSecondsLeft%60).padStart(2,"0")}.</span></div>}
          {!isLocked && error && <div style={{ display:"flex", gap:8, background:AMBER_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:AMBER_DARK }}><AlertCircle size={16} style={{ flexShrink:0, marginTop:1 }} /><span>{error}</span></div>}
          <PrimaryButton disabled={isLocked||pin.length<4} onClick={handleSubmit}><KeyRound size={16} /> Log in</PrimaryButton>
          <div style={{ marginTop:18, fontSize:11.5, color:SLATE_LIGHT, textAlign:"center" }}>Forgot your PIN? Ask your supervisor or admin to reset it.</div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════
export default function AimflowMasterApp() {
  // ── Firestore live collections ────────────────────────────────────
  const [jobHistory,    jobsLoading]    = useFireCollection(COL.jobs);
  const [fuelHistory,   fuelLoading]    = useFireCollection(COL.fuel);
  const [activeJobs,    activeLoading]  = useFireCollection(COL.activeJobs);
  const [filedEntries,  filedLoading]   = useFireCollection(COL.filed);
  const [leaveEntries,  leaveLoading]   = useFireCollection(COL.leave);
  const [archives,      archivesLoading]= useFireCollection(COL.archives);
  const [remoteUsers,   usersLoading]   = useFireCollection(COL.users);
  const [remoteVehicles,vehiclesLoading]= useFireCollection(COL.vehicles);
  const settingsDoc = useFireDoc(COL.settings, "config", null);
  const resetPassword = settingsDoc?.resetPassword || "RESET2025";
  const supervisorTeamPrefs = settingsDoc?.supervisorTeamPrefs || {};
  const removedUsers = settingsDoc?.removedUsers || []; // names removed by admin/sup — must stay removed even though they exist in USERS_DEFAULT

  const userDirectory = (() => {
    let base = USERS_DEFAULT;
    if (!usersLoading && remoteUsers.length > 0) {
      const fsMap = {};
      remoteUsers.forEach(u => { fsMap[u.name] = u; });
      const merged = USERS_DEFAULT.map(u => fsMap[u.name] ? { ...u, ...fsMap[u.name] } : u);
      remoteUsers.forEach(u => { if (!USERS_DEFAULT.find(d => d.name === u.name)) merged.push(u); });
      base = merged;
    }
    return base.filter(u => !removedUsers.includes(u.name));
  })();

  // ── Session state ─────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [screen, setScreenRaw] = useState("landing");
  // Navigation history stack — lets the back button always return to wherever the user
  // actually came from, instead of a hardcoded "normal flow" destination. This matters
  // because some screens are reachable from more than one place (e.g. fuelLogVehicle from
  // both the team-logs flow AND directly from a dashboard shortcut) — a hardcoded back
  // button only knows the "usual" path, so it can send you somewhere you didn't come from.
  // (goBack itself is declared further below, after the draft/target state it depends on
  // for screenIsValid — see that block for why.)
  const screenHistoryRef = useRef([]);
  const setScreen = useCallback((next) => {
    setScreenRaw((current) => {
      if (current !== next) screenHistoryRef.current = [...screenHistoryRef.current, current];
      return next;
    });
  }, []);

  const lastActivityRef = useRef(Date.now());

  // Reset scroll position to the top every time the screen changes. Without this, the browser
  // keeps whatever scroll position you were at on the previous screen — so navigating from
  // partway down a long list (e.g. scrolled into "Leave board") lands you partway down the
  // NEW screen too, cutting off its header until you manually scroll back up.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // ── Transient UI state ────────────────────────────────────────────
  const [draft, setDraft] = useState(emptyDraft());
  const [checkoutDraft, setCheckoutDraft] = useState(emptyCheckout());
  const [fuelDraft, setFuelDraft] = useState(emptyFuelDraft());
  const [logTeamFilter, setLogTeamFilter] = useState(null);
  const [logPersonName, setLogPersonName] = useState(null);
  const [logVehicleName, setLogVehicleName] = useState(null);
  const [jobSort, setJobSort] = useState("date_desc");
  const [fuelSort, setFuelSort] = useState("date_desc");
  const [jobSearch, setJobSearch] = useState("");
  const [filedDraft, setFiledDraft] = useState(null);
  const [filedTab, setFiledTab] = usePersisted("ops_filed_tab", "pending");
  const [reviewTarget, setReviewTarget] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [pinEditTarget, setPinEditTarget] = useState(null);
  const [pinEditValue, setPinEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dataToolsTeam, setDataToolsTeam] = useState(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteError, setDeleteError] = useState(null);
  const DELETE_CONFIRM_CODE = "DELETE9999";
  const [editTarget, setEditTarget] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [entryDeleteTarget, setEntryDeleteTarget] = useState(null);
  const [entryDeleteCode, setEntryDeleteCode] = useState("");
  const [entryDeleteError, setEntryDeleteError] = useState(null);
  const [leaveDraft, setLeaveDraft] = useState(null);
  const [leaveEditTarget, setLeaveEditTarget] = useState(null);
  const [leaveBoardTeam, setLeaveBoardTeam] = useState(null);
  const [archivePassword, setArchivePassword] = useState("");
  const [archiveRangeMode, setArchiveRangeMode] = useState("all"); // "all" | "custom"
  const [archiveTeamFilter, setArchiveTeamFilter] = useState(null); // null | "tanker" | "jetting" | "watertank"
  const [vehicleEditTarget, setVehicleEditTarget] = useState(null); // null = adding new, else the vehicle doc being edited
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newVehicleTeam, setNewVehicleTeam] = useState("tanker");
  const [vehicleDeleteTarget, setVehicleDeleteTarget] = useState(null);
  const [archiveRangeStart, setArchiveRangeStart] = useState("");
  const [archiveRangeEnd, setArchiveRangeEnd] = useState("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [restoreConfirmTarget, setRestoreConfirmTarget] = useState(null);
  const [leaveDeleteTarget, setLeaveDeleteTarget] = useState(null);
  const [showLeavePostDeleteConfirm, setShowLeavePostDeleteConfirm] = useState(false);
  const [archiveError, setArchiveError] = useState(null);
  const [archiveSuccess, setArchiveSuccess] = useState(null);
  const [newResetPw, setNewResetPw] = useState("");
  const [showSupAssign, setShowSupAssign] = useState(false);
  const [longJobWarningDismissed, setLongJobWarningDismissed] = useState(false);
  const [newUserDraft, setNewUserDraft] = useState(null);
  // Some screens require a piece of draft/target state to render correctly (e.g. leavePost
  // needs leaveDraft, reviewReject needs reviewTarget). If that state gets cleared after a
  // successful submit/cancel — which can happen at any point relative to when the screen
  // name was pushed onto history — pressing back could land on a screen with missing
  // required data, falling through to the "Unexpected screen" fallback. screenIsValid checks
  // each screen's actual requirement at the moment goBack tries to render it, so it can keep
  // popping past any now-invalid entries instead of getting stuck on one.
  const screenIsValid = useCallback((s) => {
    switch (s) {
      case "filedTimes": case "filedVehicle": case "filedSite": case "filedService":
      case "filedJobsheet": case "filedReview": return !!filedDraft;
      case "reviewReject": return !!reviewTarget;
      case "fuelVehicle": return !!fuelDraft.team;
      case "fuelDetails": return !!fuelDraft.vehicle;
      case "editEntry": return !!editTarget && !!editDraft;
      case "entryDeleteConfirm": return !!entryDeleteTarget;
      case "deleteConfirm": return !!deleteTarget;
      case "adminAddUser": return newUserDraft !== null;
      case "adminPinEdit": return !!pinEditTarget;
      case "leavePost": return leaveDraft !== null;
      default: return true; // screens with no draft/target requirement are always valid
    }
  }, [filedDraft, reviewTarget, fuelDraft, editTarget, editDraft, entryDeleteTarget, deleteTarget, newUserDraft, pinEditTarget, leaveDraft]);
  const goBack = useCallback((fallback) => {
    setScreenRaw(() => {
      let hist = screenHistoryRef.current;
      while (hist.length > 0 && !screenIsValid(hist[hist.length - 1])) {
        hist = hist.slice(0, -1); // skip past any stale entries whose required state is gone
      }
      if (hist.length > 0) {
        const prev = hist[hist.length - 1];
        screenHistoryRef.current = hist.slice(0, -1);
        return prev;
      }
      screenHistoryRef.current = [];
      return fallback || "landing";
    });
  }, [screenIsValid]);
  const [editUserTeam, setEditUserTeam] = useState(undefined);
  const [pinEditConfirmAction, setPinEditConfirmAction] = useState(null); // null | "remove" | "revoke" | "rename"
  const [nameEditValue, setNameEditValue] = useState("");
  const [syncError, setSyncError] = useState(null);
  const syncOpCountRef = useRef(0); // tracks overlapping in-flight Firestore writes for the global "Saving…" indicator
  const [betaActiveJobs, setBetaActiveJobs] = useState([]);
  const [betaJobHistory, setBetaJobHistory] = useState([]);
  const [betaFuelHistory, setBetaFuelHistory] = useState([]);

  // ── Session timeout ───────────────────────────────────────────────
  useEffect(() => {
    const bump = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("touchstart", bump);
    window.addEventListener("click", bump);
    window.addEventListener("keydown", bump);
    const check = setInterval(() => {
      if (session && Date.now() - lastActivityRef.current > 30 * 60 * 1000) handleLogout();
    }, 60000);
    return () => { window.removeEventListener("touchstart", bump); window.removeEventListener("click", bump); window.removeEventListener("keydown", bump); clearInterval(check); };
  }, [session]);

  // ── Seed users to Firestore on first load ─────────────────────────
  useEffect(() => {
    if (!usersLoading && remoteUsers.length === 0) {
      const batch = writeBatch(db);
      USERS_DEFAULT.forEach(u => batch.set(doc(db, COL.users, u.name), u));
      batch.commit().catch(e => console.error("Seed users:", e));
    }
  }, [usersLoading, remoteUsers.length]);

  // ── Seed vehicles to Firestore on first load (from the original hardcoded lists,
  //    minus the generic "Others" entry which stays as a built-in option, not a managed vehicle) ──
  useEffect(() => {
    if (!vehiclesLoading && remoteVehicles.length === 0) {
      const seedList = [
        ...TANKER_VEHICLES.filter(v => v !== "Others").map(plate => ({ plate, team: "tanker", active: true })),
        ...JETTING_VEHICLES.filter(v => v !== "Others").map(plate => ({ plate, team: "jetting", active: true })),
        ...WATERTANK_VEHICLES.filter(v => v !== "Others").map(plate => ({ plate, team: "watertank", active: true })),
      ];
      const batch = writeBatch(db);
      seedList.forEach(v => batch.set(doc(collection(db, COL.vehicles)), v));
      batch.commit().catch(e => console.error("Seed vehicles:", e));
    }
  }, [vehiclesLoading, remoteVehicles.length]);

  const isBeta = session?.role === "beta";
  const myActiveJobsAll = isBeta ? betaActiveJobs : activeJobs;
  const currentJobHistory = isBeta ? betaJobHistory : jobHistory;
  const currentFuelHistory = isBeta ? betaFuelHistory : fuelHistory;
  const myActiveJob = session ? myActiveJobsAll.find(j => j.checker === session.name) || null : null;
  // Active jobs where I'm listed as crew on SOMEONE ELSE's check-in (not my own active job).
  // Informational only — does not lock me out of starting my own separate check-in.
  const myCrewActiveJobs = session ? myActiveJobsAll.filter(j => j.checker !== session.name && (j.crew||[]).includes(session.name)) : [];
  const myLastCompletedJob = session ? [...currentJobHistory].filter(j => j.checker===session.name||(j.crew||[]).includes(session.name)).sort((a,b)=>b.checkOutTime-a.checkOutTime)[0]||null : null;
  const myLastFillUp = session ? [...currentFuelHistory].filter(f=>f.person===session.name).sort((a,b)=>b.date-a.date)[0]||null : null;
  const elapsed = useElapsed(myActiveJob ? myActiveJob.checkInTime : null);

  const nowFn = () => { if(isBeta&&draft.manualCheckIn){const t=new Date(draft.manualCheckIn).getTime();if(!isNaN(t))return t;} return Date.now(); };
  const checkoutNowFn = () => { if(isBeta&&checkoutDraft.manualCheckOut){const t=new Date(checkoutDraft.manualCheckOut).getTime();if(!isNaN(t))return t;} return Date.now(); };
  const handleLogin = (user) => { lastActivityRef.current=Date.now(); setSession(user); setScreen("landing"); };
  const handleLogout = () => { screenHistoryRef.current = []; setSession(null); setScreenRaw("landing"); setDraft(emptyDraft()); setCheckoutDraft(emptyCheckout()); setFuelDraft(emptyFuelDraft()); setLogPersonName(null); setLogVehicleName(null); setLogTeamFilter(null); };

  // ── Firestore write helpers ───────────────────────────────────────
  const fsOp = async (fn) => {
    syncOpCountRef.current += 1;
    setGlobalSyncing(true);
    try { await fn(); setSyncError(null); }
    catch(e) { console.error(e); setSyncError("Sync error — check your connection."); }
    finally {
      syncOpCountRef.current -= 1;
      if (syncOpCountRef.current <= 0) { syncOpCountRef.current = 0; setGlobalSyncing(false); }
    }
  };
  const addJob = (job) => fsOp(() => fsSet(COL.jobs, job.id, job));
  const updateJob = (id, data) => fsOp(() => fsUpdate(COL.jobs, id, data));
  const deleteJob = (id) => fsOp(() => fsDelete(COL.jobs, id));
  const addFuel = (rec) => fsOp(() => fsSet(COL.fuel, rec.id, rec));
  const setActiveJob = (job) => fsOp(() => fsSet(COL.activeJobs, job.checker, job));
  const clearActiveJob = (checker) => fsOp(() => fsDelete(COL.activeJobs, checker));
  const addFiledEntry = (entry) => fsOp(() => fsSet(COL.filed, entry.id, entry));
  const updateFiledEntry = (id, data) => fsOp(() => fsUpdate(COL.filed, id, data));
  const deleteFiledEntry = (id) => fsOp(() => fsDelete(COL.filed, id));
  const addLeave = (entry) => fsOp(() => fsSet(COL.leave, entry.id, entry));
  const updateLeave = (id, data) => fsOp(() => fsUpdate(COL.leave, id, data));
  const deleteLeave = (id) => fsOp(() => fsDelete(COL.leave, id));
  const updateUser = (name, data) => fsOp(() => fsSet(COL.users, name, data));
  const addUser = (user) => fsOp(() => fsSet(COL.users, user.name, user));
  const removeUser = (name) => fsOp(async () => {
    await fsDelete(COL.users, name); // remove Firestore doc if it exists (covers added-not-seeded users)
    const next = [...new Set([...removedUsers, name])];
    await fsSet(COL.settings, "config", { ...(settingsDoc||{}), removedUsers: next });
  });
  // Renames a person everywhere: their user record, and every historical job/fuel/filed/leave
  // record that references their old name. Archives are intentionally left untouched.
  const renameUser = (oldName, newName) => fsOp(() => fsRenamePerson(oldName, newName));
  const updateSettings = (data) => fsOp(() => fsSet(COL.settings, "config", { ...(settingsDoc||{}), ...data }));
  const setSupervisorTeamPrefs = (prefs) => updateSettings({ supervisorTeamPrefs: prefs });

  // ── executeDeletion ───────────────────────────────────────────────
  const executeDeletion = async (target) => {
    if (target==="beta") { setBetaJobHistory([]); setBetaFuelHistory([]); setBetaActiveJobs([]); return; }
    if (["tanker","jetting","watertank"].includes(target)) {
      await fsOp(async()=>{ await fsDeleteWhere(COL.jobs,"team",target); await fsDeleteWhere(COL.fuel,"team",target); await fsDeleteWhere(COL.activeJobs,"team",target); await fsDeleteWhere(COL.filed,"team",target); });
    } else if (target.startsWith("jobs:")) {
      const t=target.slice(5); await fsOp(async()=>{ await fsDeleteWhere(COL.jobs,"team",t); await fsDeleteWhere(COL.activeJobs,"team",t); });
    } else if (target.startsWith("fuelteam:")) {
      await fsOp(()=>fsDeleteWhere(COL.fuel,"team",target.slice(9)));
    } else if (target.startsWith("vehicle:")) {
      await fsOp(()=>fsDeleteWhere(COL.fuel,"vehicle",target.slice(8)));
    } else if (target==="all_live") {
      await fsOp(async()=>{ await fsDeleteCollection(COL.jobs); await fsDeleteCollection(COL.fuel); await fsDeleteCollection(COL.activeJobs); await fsDeleteCollection(COL.filed); await fsDeleteCollection(COL.leave); });
    } else if (target==="everything") {
      await fsOp(async()=>{ await fsDeleteCollection(COL.jobs); await fsDeleteCollection(COL.fuel); await fsDeleteCollection(COL.activeJobs); await fsDeleteCollection(COL.filed); await fsDeleteCollection(COL.leave); });
      setBetaJobHistory([]); setBetaFuelHistory([]); setBetaActiveJobs([]);
    }
  };

  // ── CSV / PDF ─────────────────────────────────────────────────────
  function exportCSV(data,filename){if(!data.length)return;const keys=Object.keys(data[0]);const rows=[keys.join(","),...data.map(r=>keys.map(k=>`"${String(r[k]||"").replace(/"/g,'""')}"`).join(","))];const blob=new Blob([rows.join("\n")],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
  function exportJobsCSV(jobs){exportCSV(jobs.map(j=>({Date:j.checkInTime?new Date(j.checkInTime).toLocaleDateString("en-SG"):"",CheckIn:j.checkInTime?new Date(j.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"}):"",CheckOut:j.checkOutTime?new Date(j.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"}):"",Team:teamLabel(j.team),JobSite:j.jobSite,CheckedInBy:j.checker,Crew:(j.crew||[]).join("; "),Vehicles:(j.vehicles||[]).join("; "),Hours:j.hours,OT_Hours:calcOT(j.checkInTime,j.checkOutTime).toFixed(1),DayType:getDayType(j.checkInTime),Services:(j.serviceLines||[]).map(l=>`${l.type}${l.qty?` x${l.qty}`:""}${l.freq?` (${l.freq})`:""}${l.levels?.length?` [${l.levels.join(",")}]`:""}${l.detail?` - ${l.detail}`:""}`).join("; "),Jobsheet:j.jobsheet||"",PUB_Disposal:j.pubDisposal||"",Remarks:j.remarks||"",Filed_Entry:j.wasFiledEntry?"Yes":"No",Filed_Reason:j.filedReason||""})),`opsflow_jobs_${sgToday()}.csv`);}
  function exportFuelCSV(fuel){exportCSV(fuel.map(f=>({Date:f.date?new Date(f.date).toLocaleDateString("en-SG"):"",Time:f.date?new Date(f.date).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"}):"",Team:teamLabel(f.team),Person:f.person,Vehicle:f.vehicle,Company:f.company,Litres:f.amount,Price_SGD:f.price,Mileage_km:f.mileage,Aux_Mileage_km:f.mileageAux||"",Tank:f.tank||"",Cost_Per_Litre:f.amount&&f.price?(parseFloat(f.price)/parseFloat(f.amount)).toFixed(3):""})),`opsflow_fuel_${sgToday()}.csv`);}
  function exportPDF(jobs,fuel){const win=window.open("","_blank");const today=new Date().toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"});const jobRows=jobs.map(j=>`<tr><td>${j.checkInTime?new Date(j.checkInTime).toLocaleDateString("en-SG"):""}</td><td>${teamLabel(j.team)}</td><td>${j.jobSite}</td><td>${j.checker}</td><td>${(j.crew||[]).join(", ")}</td><td>${(j.serviceLines||[]).map(l=>`${l.type}${l.qty?` x${l.qty}`:""}`).join("; ")}</td><td>${j.hours}</td><td>${calcOT(j.checkInTime,j.checkOutTime).toFixed(1)}</td><td>${j.jobsheet||""}</td></tr>`).join("");const fuelRows=fuel.map(f=>`<tr><td>${f.date?new Date(f.date).toLocaleDateString("en-SG"):""}</td><td>${teamLabel(f.team)}</td><td>${f.person}</td><td>${f.vehicle}</td><td>${f.company}</td><td>${f.amount}L</td><td>S$${f.price}</td><td>${f.amount&&f.price?(parseFloat(f.price)/parseFloat(f.amount)).toFixed(3):""}</td></tr>`).join("");win.document.write(`<!DOCTYPE html><html><head><title>Opsflow Export ${today}</title><style>body{font-family:Arial,sans-serif;font-size:10px;padding:16px}h1{font-size:14px}h2{font-size:12px;margin-top:20px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f0f4ff}tr:nth-child(even){background:#fafafa}</style></head><body><h1>Opsflow — Aimflow Pte Ltd</h1><p>Exported: ${today}</p><h2>Jobs (${jobs.length})</h2><table><tr><th>Date</th><th>Team</th><th>Site</th><th>Checker</th><th>Crew</th><th>Services</th><th>Hrs</th><th>OT</th><th>Jobsheet</th></tr>${jobRows}</table><h2>Fuel (${fuel.length})</h2><table><tr><th>Date</th><th>Team</th><th>Person</th><th>Vehicle</th><th>Station</th><th>Amount</th><th>Price</th><th>$/L</th></tr>${fuelRows}</table></body></html>`);win.document.close();win.print();}

  // ── Archive / reset ───────────────────────────────────────────────
  // rangeStart/rangeEnd are "YYYY-MM-DD" strings (inclusive). teamFilter is "tanker"|"jetting"|"watertank"|null (null = all teams).
  // Both filters are independent and combine: e.g. team=tanker + range=June archives only Tanker's June records.
  async function doArchiveReset(pw, rangeStart, rangeEnd, teamFilter, label) {
    if (pw!==resetPassword){setArchiveError("Incorrect reset password.");return false;}
    const startTs = rangeStart ? new Date(`${rangeStart}T00:00:00+08:00`).getTime() : -Infinity;
    const endTs = rangeEnd ? new Date(`${rangeEnd}T23:59:59+08:00`).getTime() : Infinity;
    const inRange = (ts) => ts >= startTs && ts <= endTs;
    const inTeam = (t) => !teamFilter || t === teamFilter;

    const jobsInRange = jobHistory.filter(j => inRange(j.checkInTime) && inTeam(j.team));
    const fuelInRange = fuelHistory.filter(f => inRange(f.date) && inTeam(f.team));
    const filedInRange = filedEntries.filter(e => inRange(e.checkInTime || e.filedAt) && inTeam(e.team));

    if (jobsInRange.length === 0 && fuelInRange.length === 0 && filedInRange.length === 0) {
      setArchiveError("No records found for that team and date range.");
      return false;
    }

    const teamPart = teamFilter ? `${teamLabel(teamFilter)} — ` : "";
    const finalLabel = label || (rangeStart && rangeEnd
      ? `${teamPart}${new Date(`${rangeStart}T12:00:00+08:00`).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"})} – ${new Date(`${rangeEnd}T12:00:00+08:00`).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"})}`
      : `${teamPart}${new Date().toLocaleDateString("en-SG",{month:"short",year:"numeric"})}`);

    const snapshot={ id:`archive-${Date.now()}`, label:finalLabel, archivedAt:Date.now(), archivedBy:session.name, rangeStart:rangeStart||null, rangeEnd:rangeEnd||null, team:teamFilter||null, jobs:jobsInRange, fuel:fuelInRange, filed:filedInRange };
    await fsOp(()=>fsSet(COL.archives,snapshot.id,snapshot));
    // Only delete the records that were actually archived — anything outside the range/team stays live.
    await fsOp(async () => {
      for (const j of jobsInRange) await fsDelete(COL.jobs, j.id);
      for (const f of fuelInRange) await fsDelete(COL.fuel, f.id);
      for (const e of filedInRange) await fsDelete(COL.filed, e.id);
    });
    setArchiveError(null);setArchiveSuccess(`${finalLabel}: ${jobsInRange.length} jobs, ${fuelInRange.length} fuel records, ${filedInRange.length} filed entries archived and reset.`);
    return true;
  }
  function restoreArchive(arc) {
    arc.jobs?.forEach(j=>addJob(j));
    arc.fuel?.forEach(f=>addFuel(f));
    arc.filed?.forEach(e=>addFiledEntry(e));
    setArchiveSuccess(`Restored ${arc.label} data.`);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function getSupTeams(supName){if(supervisorTeamPrefs[supName])return supervisorTeamPrefs[supName];const u=userDirectory.find(x=>x.name===supName);return u?.supervisorTeams||["tanker","jetting","watertank"];}
  const mySupTeams=session?.role==="supervisor"?getSupTeams(session.name):["tanker","jetting","watertank"];

  // Live vehicle directory, sourced from Firestore once loaded (falls back to the original
  // hardcoded lists before the first load completes, so check-in screens never show an empty list).
  // This shadows the module-level `teamVehicles` function for every call site inside this component.
  function teamVehicles(team) {
    if (vehiclesLoading || remoteVehicles.length === 0) {
      if (team === "jetting") return JETTING_VEHICLES;
      if (team === "watertank") return WATERTANK_VEHICLES;
      return TANKER_VEHICLES;
    }
    const active = remoteVehicles.filter(v => v.team === team && v.active !== false).map(v => v.plate).sort((a,b)=>a.localeCompare(b));
    return [...active, "Others"];
  }
  const addVehicle = (plate, team) => fsOp(() => fsAdd(COL.vehicles, { plate: plate.trim(), team, active: true }));
  const updateVehicle = (id, data) => fsOp(() => fsUpdate(COL.vehicles, id, data));
  const removeVehicle = (id) => fsOp(() => fsDelete(COL.vehicles, id)); // hard delete is fine here — vehicle plate strings on past records are just text, not a foreign key into this collection

  function checkDuplicate(team,jobSite){if(!jobSite)return false;const today=sgToday();return currentJobHistory.some(j=>{const jDate=j.checkInTime?new Date(j.checkInTime).toLocaleDateString("en-CA",{timeZone:"Asia/Singapore"}):null;return j.team===team&&j.checker===session.name&&jDate===today&&j.jobSite.toLowerCase().trim()===jobSite.toLowerCase().trim();});}
  const isAdminOrSup=session&&(session.role==="admin"||session.role==="supervisor"||session.role==="beta");
  const isTeamLead=session&&(session.role==="admin"||session.role==="supervisor");
  const jobHoursNow=myActiveJob?(Date.now()-myActiveJob.checkInTime)/3600000:0;
  const isLongJob=jobHoursNow>12;
  const myCumulative=session?personTotals(currentJobHistory,session.name):{hours:0,ot:0,jobCount:0};
  const pendingCount=filedEntries.filter(e=>e.status==="pending").length;
  const todayOut=leaveEntries.filter(e=>isLeaveActiveToday(e));
  const soon=leaveEntries.filter(e=>{if(isLeaveActiveToday(e))return false;const today=sgToday(),cutoff=new Date(`${today}T00:00:00+08:00`).getTime()+30*86400000,start=new Date(`${e.startDate}T00:00:00+08:00`).getTime();return start>new Date(`${today}T00:00:00+08:00`).getTime()&&start<=cutoff;});
  const isLoading=jobsLoading||fuelLoading||activeLoading||filedLoading;

  if(!session)return <LoginScreen onLogin={handleLogin} userDirectory={userDirectory}/>;
  if(isLoading)return(
    <div style={{minHeight:"100vh",background:CANVAS,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,fontFamily:"'Inter',-apple-system,sans-serif"}}>
      <div style={{width:40,height:40,borderRadius:"50%",border:`3px solid ${BLUE_LIGHT}`,borderTop:`3px solid ${BLUE}`,animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:13,color:SLATE,fontWeight:600}}>Loading Opsflow…</div>
    </div>
  );

  if (screen === "landing") {
    const isWorker = session.role === "worker";
    const isAdmin = session.role === "admin";
    const isSupervisor = session.role === "supervisor";

    return (
      <Shell>
        <AppHeader session={session} onLogout={handleLogout} />
        <OfflineBanner />

        {isBeta && (
          <div style={{ display:"flex", gap:8, background:PURPLE_LIGHT, borderRadius:12, padding:"11px 13px", marginBottom:14, fontSize:12, color:PURPLE }}>
            <ShieldAlert size={16} style={{ flexShrink:0, marginTop:1 }} />
            <span>Beta test mode — isolated, never touches live data.</span>
          </div>
        )}

        {/* Active job card */}
        {myActiveJob && (
          <div style={{ background:`linear-gradient(135deg, #D97706, #B45309)`, borderRadius:16, padding:18, color:"white", marginBottom:14, boxShadow:`0 10px 26px #D9770640`, border:"2px solid #FBBF24" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#FEF08A", boxShadow:"0 0 0 4px rgba(254,240,138,0.35)" }} />
              <span style={{ fontSize:11, fontWeight:800, letterSpacing:0.6, opacity:0.95 }}>ONGOING · {teamLabel(myActiveJob.team).toUpperCase()}</span>
            </div>
            <div style={{ fontSize:16, fontWeight:700 }}>{myActiveJob.jobSite}</div>
            <div style={{ fontSize:12, opacity:0.85, marginBottom:8 }}>
              {new Date(myActiveJob.checkInTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short"})}
              {" · "}Checked in at {new Date(myActiveJob.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})} · {elapsed} elapsed
            </div>
            {isLongJob && !longJobWarningDismissed && (
              <div style={{ background:"rgba(255,255,255,0.2)", borderRadius:10, padding:"9px 12px", marginBottom:10, fontSize:12, color:"white", display:"flex", gap:8, alignItems:"flex-start" }}>
                <AlertTriangle size={14} style={{ flexShrink:0, marginTop:1 }} />
                <span>⚠️ Job exceeds 12 hours. Supervisor and admin have been flagged.</span>
              </div>
            )}
            {(myActiveJob.vehicles?.length > 0 || myActiveJob.crew?.length > 0) && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
                {myActiveJob.vehicles?.map((v)=><span key={v} style={{ ...pillStyle, display:"inline-flex", alignItems:"center", gap:5 }}><Truck size={11} />{v}</span>)}
                {myActiveJob.crew?.map((name)=><span key={name} style={{ ...pillStyle, display:"inline-flex", alignItems:"center", gap:5 }}><Users size={11} />{name}</span>)}
              </div>
            )}
            <button onClick={() => setScreen("checkoutGreet")} style={{ width:"100%", background:"#FEF08A", color:"#78350F", border:"none", borderRadius:10, padding:13, fontSize:14.5, fontWeight:800, cursor:"pointer", boxShadow:"0 4px 14px rgba(254,240,138,0.5)", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              <AlertTriangle size={16} /> Remember to check out
            </button>
          </div>
        )}

        {/* Long job alert for supervisors/admin */}
        {isTeamLead && !isBeta && (() => {
          const longJobs = activeJobs.filter((j) => (Date.now()-j.checkInTime)/3600000 > 12);
          if (!longJobs.length) return null;
          return (
            <div style={{ border:`1.5px solid ${AMBER}`, background:AMBER_LIGHT, borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:AMBER_DARK, marginBottom:6 }}>⚠️ Long jobs flagged ({longJobs.length})</div>
              {longJobs.map((j) => (
                <div key={j.id||j.checker} style={{ fontSize:12, color:AMBER_DARK, marginBottom:2 }}>
                  {j.checker} — {j.jobSite} ({Math.floor((Date.now()-j.checkInTime)/3600000)}h elapsed)
                </div>
              ))}
            </div>
          );
        })()}

        {/* Informational badge — I'm listed as crew on someone else's currently active job.
            Read-only: no lock, no checkout access. I can still independently check into a different job. */}
        {myCrewActiveJobs.length > 0 && myCrewActiveJobs.map((j) => (
          <div key={j.id} style={{ display:"flex", alignItems:"center", gap:12, background:`linear-gradient(135deg, ${PURPLE}, #4C2E94)`, borderRadius:14, padding:"14px 16px", marginBottom:14, boxShadow:`0 8px 20px ${PURPLE}35` }}>
            <div style={{ width:38, height:38, borderRadius:11, background:"rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Users size={18} color="white" />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:0.5, color:"rgba(255,255,255,0.75)", textTransform:"uppercase", marginBottom:2 }}>You're on an active job</div>
              <div style={{ fontSize:13.5, fontWeight:700, color:"white" }}>{j.jobSite || "Site not recorded"}</div>
              <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.8)" }}>Checked in by {j.checker}</div>
            </div>
          </div>
        ))}

        {/* Last fill-up status card — workers only */}
        {isWorker && <FuelStatusCard lastFillUp={myLastFillUp} fuelHistory={currentFuelHistory} />}

        {/* Last completed job card (workers only, when no active job) */}
        {!myActiveJob && myLastCompletedJob && isWorker && (
          <div style={{ background:`linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})`, borderRadius:16, padding:18, color:"white", marginBottom:14, boxShadow:`0 10px 26px ${GREEN_DARK}33` }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <CheckCircle2 size={13} color="#D7F5E9" />
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:0.6, opacity:0.92 }}>LAST JOB · {teamLabel(myLastCompletedJob.team).toUpperCase()}</span>
            </div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:3 }}>{myLastCompletedJob.jobSite}</div>
            <div style={{ fontSize:12, opacity:0.82, marginBottom:10 }}>
              {new Date(myLastCompletedJob.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
              {" – "}{new Date(myLastCompletedJob.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
              {" · "}{myLastCompletedJob.hours} hrs
              {" · "}{new Date(myLastCompletedJob.checkOutTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"})}
            </div>
            {myLastCompletedJob.serviceLines?.length > 0 && (
              <div style={{ background:"rgba(255,255,255,0.12)", borderRadius:9, padding:"8px 11px", marginBottom:8, fontSize:11.5, lineHeight:1.6 }}>
                {myLastCompletedJob.serviceLines.map((l,i) => (
                  <div key={i}>• {l.type}{l.qty ? ` ×${l.qty}` : ""}{l.freq ? ` (${l.freq})` : ""}{l.detail ? ` — ${l.detail}` : ""}</div>
                ))}
              </div>
            )}
            {myLastCompletedJob.crew?.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {myLastCompletedJob.crew.map((name) => (
                  <span key={name} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:6, background:"rgba(255,255,255,0.15)" }}><Users size={10} />{name}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!myActiveJob && !myLastCompletedJob && isWorker && (
          <div style={{ border:`1px solid ${BORDER}`, borderRadius:16, padding:17, marginBottom:14, background:"white" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:SLATE_LIGHT }} />
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:0.6, color:SLATE }}>OFF THE CLOCK</span>
            </div>
            <div style={{ fontSize:12, color:SLATE_LIGHT }}>No jobs logged yet</div>
          </div>
        )}

        {/* Filed status bar — worker */}
        {isWorker && (() => {
          const mine = filedEntries.filter((e)=>e.filedBy===session.name||e.checker===session.name||(e.crew||[]).includes(session.name));
          const pending = mine.filter((e)=>e.status==="pending").length;
          const approved = mine.filter((e)=>e.status==="approved").length;
          const rejected = mine.filter((e)=>e.status==="rejected").length;
          if (!pending && !approved && !rejected) return null;
          return (
            <button onClick={()=>{setFiledTab("pending");setScreen("myFiledEntries");}} style={{ width:"100%", display:"flex", flexDirection:"column", gap:8, padding:"12px 14px", borderRadius:14, border:`1px solid ${BORDER}`, background:"white", marginBottom:14, cursor:"pointer", textAlign:"left" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <FileClock size={12} color={SLATE} />
                <span style={{ fontSize:10.5, fontWeight:700, color:SLATE, letterSpacing:0.4, textTransform:"uppercase" }}>Your filed entries</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {pending>0 && <span style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"#FEF0E6", borderRadius:10, padding:"9px 11px" }}><FileClock size={15} color="#C2570C" /><span><span style={{ display:"block", fontSize:13, fontWeight:800, color:"#C2570C" }}>{pending}</span><span style={{ display:"block", fontSize:9.5, fontWeight:700, color:"#92521A", letterSpacing:0.3 }}>PENDING</span></span></span>}
                {approved>0 && <span style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:GREEN_LIGHT, borderRadius:10, padding:"9px 11px" }}><CheckCircle2 size={15} color={GREEN_DARK} /><span><span style={{ display:"block", fontSize:13, fontWeight:800, color:GREEN_DARK }}>{approved}</span><span style={{ display:"block", fontSize:9.5, fontWeight:700, color:GREEN_DARK, letterSpacing:0.3 }}>APPROVED</span></span></span>}
                {rejected>0 && <span style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:RED_LIGHT, borderRadius:10, padding:"9px 11px" }}><XCircle size={15} color={RED} /><span><span style={{ display:"block", fontSize:13, fontWeight:800, color:RED }}>{rejected}</span><span style={{ display:"block", fontSize:9.5, fontWeight:700, color:RED, letterSpacing:0.3 }}>REJECTED</span></span></span>}
              </div>
            </button>
          );
        })()}

        {/* My hours summary */}
        {(isWorker || isSupervisor) && myCumulative.hours > 0 && (
          <div style={{ display:"flex", gap:10, marginBottom:16 }}>
            <div style={{ flex:1, background:BLUE_LIGHT, border:`1px solid ${BLUE}22`, borderRadius:14, padding:"13px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}><Clock size={12} color={BLUE} /><span style={{ fontSize:10, color:BLUE_DARK, fontWeight:700, letterSpacing:0.4 }}>MY TOTAL HRS</span></div>
              <div style={{ fontSize:21, fontWeight:800, color:BLUE_DARK, letterSpacing:-0.3 }}>{myCumulative.hours.toFixed(1)}</div>
            </div>
            <div style={{ flex:1, background:AMBER_LIGHT, border:`1px solid ${AMBER}22`, borderRadius:14, padding:"13px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}><TrendingUp size={12} color={AMBER_DARK} /><span style={{ fontSize:10, color:AMBER_DARK, fontWeight:700, letterSpacing:0.4 }}>TENTATIVE OT</span></div>
              <div style={{ fontSize:21, fontWeight:800, color:AMBER_DARK, letterSpacing:-0.3 }}>{myCumulative.ot.toFixed(1)}</div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <SectionLabel accent={BLUE}>Quick actions</SectionLabel>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <button onClick={()=>setScreen("checkinoutTeam")} style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:8, padding:16, borderRadius:16, border:`1.5px solid ${BLUE}22`, background:BLUE_LIGHT, cursor:"pointer", textAlign:"left", boxShadow:`0 2px 8px ${BLUE}18` }}>
            <span style={{ width:40, height:40, borderRadius:12, background:BLUE, display:"flex", alignItems:"center", justifyContent:"center" }}><ClipboardList size={20} color="white" /></span>
            <span><span style={{ display:"block", fontSize:14, fontWeight:700, color:BLUE_DARK }}>Check In / Out</span><span style={{ display:"block", fontSize:11, color:BLUE, marginTop:1, fontWeight:500 }}>Log a job site</span></span>
          </button>
          <button onClick={()=>setScreen("fuelTeam")} style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:8, padding:16, borderRadius:16, border:`1.5px solid ${AMBER}33`, background:AMBER_LIGHT, cursor:"pointer", textAlign:"left", boxShadow:`0 2px 8px ${AMBER}18` }}>
            <span style={{ width:40, height:40, borderRadius:12, background:AMBER, display:"flex", alignItems:"center", justifyContent:"center" }}><Fuel size={20} color="white" /></span>
            <span><span style={{ display:"block", fontSize:14, fontWeight:700, color:AMBER_DARK }}>Fuel Fill-up</span><span style={{ display:"block", fontSize:11, color:AMBER_DARK, marginTop:1, fontWeight:500, opacity:0.8 }}>Log a top-up</span></span>
          </button>
        </div>

        {/* My tools section */}
        <SectionLabel accent={PURPLE}>My tools</SectionLabel>

        {(isWorker || isSupervisor) && (
          <button onClick={()=>{setLogPersonName(null);setLogVehicleName(null);setLogTeamFilter(null);setScreen("myJobLog");}} style={tileStyle()}>
            <span style={{ ...tileIconStyle, background:"#F1EFE8" }}><ClipboardList size={22} color="#5F5E5A" /></span>
            <span style={{ flex:1 }}><span style={tileTitleStyle}>My logs</span><span style={tileSubStyle}>My job history, hours and OT</span></span>
          </button>
        )}

        {isWorker && (
          <button onClick={()=>{setLogTeamFilter(session.team);setScreen("jobLogView");}} style={tileStyle()}>
            <span style={{ ...tileIconStyle, background:PURPLE_LIGHT }}><Users size={22} color={PURPLE} /></span>
            <span style={{ flex:1 }}><span style={tileTitleStyle}>Team logs</span><span style={tileSubStyle}>See your team's job activity</span></span>
          </button>
        )}

        {isWorker && (
          <button onClick={()=>{setLogPersonName(null);setScreen("personnelLog");}} style={tileStyle()}>
            <span style={{ ...tileIconStyle, background:BLUE_LIGHT }}><Search size={22} color={BLUE} /></span>
            <span style={{ flex:1 }}><span style={tileTitleStyle}>Look up a teammate</span><span style={tileSubStyle}>Find one person's job history</span></span>
          </button>
        )}

        <button onClick={()=>setScreen("leaveBoard")} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:"#F0FDF4" }}><BedDouble size={22} color={GREEN_DARK} /></span>
          <span style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span><span style={tileTitleStyle}>Leave board</span><span style={tileSubStyle}>{todayOut.length>0?`${todayOut.length} out today`:"Who's in and who's out"}{soon.length>0?` · ${soon.length} upcoming`:""}</span></span>
            {todayOut.length>0 && <span style={{ fontSize:12, fontWeight:800, color:"white", background:RED, borderRadius:20, padding:"3px 9px", flexShrink:0 }}>{todayOut.length} out</span>}
          </span>
        </button>

        <button onClick={()=>{setFiledDraft(emptyFiledDraft());setScreen("filedTeam");}} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:"#FEF0E6" }}><FileClock size={22} color="#C2570C" /></span>
          <span style={{ flex:1 }}><span style={tileTitleStyle}>File a missed check-in</span><span style={tileSubStyle}>Forgot to check in or out? File for approval</span></span>
        </button>

        {/* Team section — supervisors & admin */}
        {isTeamLead && !isBeta && (
          <>
            <SectionLabel accent={AMBER}>Team</SectionLabel>

            {/* Review filed entries — always visible, badge shows pending count */}
            <button onClick={()=>{setScreen("reviewQueue");}} style={{ ...tileStyle(), ...(pendingCount > 0 ? { border:`1.5px solid #C2570C`, background:"#FEF0E6" } : {}) }}>
              <span style={{ ...tileIconStyle, background: pendingCount > 0 ? "#C2570C" : "#FEF0E6" }}><FileClock size={22} color={pendingCount > 0 ? "white" : "#C2570C"} /></span>
              <span style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span>
                  <span style={{ ...tileTitleStyle, color: pendingCount > 0 ? "#7C3D08" : INK }}>Review filed entries</span>
                  <span style={{ ...tileSubStyle, color: pendingCount > 0 ? "#92521A" : SLATE }}>
                    {pendingCount > 0 ? `${pendingCount} pending approval` : "Missed check-in submissions"}
                  </span>
                </span>
                {pendingCount > 0 && <span style={{ fontSize:13, fontWeight:800, color:"white", background:"#C2570C", borderRadius:20, padding:"3px 10px", flexShrink:0 }}>{pendingCount}</span>}
              </span>
            </button>

            {/* Team last-job cards */}
            <SectionLabel accent={GREEN_DARK}>Last completed job by team</SectionLabel>
            {(isAdmin ? ["tanker","jetting","watertank"] : mySupTeams).map((t) => (
              <TeamLastJobCard key={t} team={t} jobHistory={jobHistory} filedEntries={filedEntries}
                onClick={()=>{setLogTeamFilter(t);setScreen("jobLogView");}} />
            ))}

            {/* Team last-fuel cards */}
            <SectionLabel accent={AMBER_DARK}>Last fill-up by team</SectionLabel>
            {(isAdmin ? ["tanker","jetting","watertank"] : mySupTeams).map((t) => (
              <TeamLastFuelCard key={t} team={t} fuelHistory={fuelHistory}
                onClick={()=>{setLogTeamFilter(t);setLogVehicleName(null);setScreen("fuelLogVehicle");}} />
            ))}

            {/* Team hours overview */}
            <SectionLabel accent={BLUE}>Team hours overview</SectionLabel>
            {(isAdmin ? ["tanker","jetting","watertank"] : mySupTeams).map((t) => {
              const teamJobs = jobHistory.filter((j)=>j.team===t);
              const { hours: totHrs, ot: totOT } = teamTotals(teamJobs);
              const accent = teamAccent(t);
              return (
                <div key={t} style={{ display:"flex", alignItems:"center", gap:12, border:`1px solid ${BORDER}`, borderRadius:12, padding:"12px 14px", marginBottom:8, background:"white" }}>
                  <TeamIcon team={t} size={18} color={accent} />
                  <span style={{ fontSize:13, fontWeight:700, color:INK, flex:1 }}>{teamLabel(t)}</span>
                  <span style={{ fontSize:12, color:SLATE, fontWeight:600 }}>{totHrs.toFixed(1)} hrs</span>
                  <span style={{ fontSize:12, color:AMBER_DARK, fontWeight:700, background:AMBER_LIGHT, borderRadius:8, padding:"3px 9px" }}>{totOT.toFixed(1)} OT</span>
                </div>
              );
            })}

            {/* Supervisor team preferences */}
            {isSupervisor && (
              <button onClick={()=>setShowSupAssign(true)} style={{ ...tileStyle(), marginTop:8 }}>
                <span style={{ ...tileIconStyle, background:BLUE_LIGHT }}><Settings size={22} color={BLUE} /></span>
                <span><span style={tileTitleStyle}>My team view</span><span style={tileSubStyle}>Select which teams to monitor</span></span>
              </button>
            )}

            {/* Admin tools */}
            <button onClick={()=>setScreen("adminTools")} style={tileStyle()}>
              <span style={{ ...tileIconStyle, background:PURPLE_LIGHT }}><Users size={22} color={PURPLE} /></span>
              <span style={{ flex:1 }}><span style={tileTitleStyle}>Admin tools</span><span style={tileSubStyle}>Users, PINs, data management, archive</span></span>
            </button>

            {/* Full team logs */}
            <button onClick={()=>{setLogTeamFilter(null);setScreen("logsHome");}} style={tileStyle()}>
              <span style={{ ...tileIconStyle, background:"#F1EFE8" }}><ClipboardList size={22} color="#5F5E5A" /></span>
              <span><span style={tileTitleStyle}>Team logs</span><span style={tileSubStyle}>Full job & fuel history across all teams</span></span>
            </button>
          </>
        )}

        {isBeta && (
          <button onClick={()=>{setDeleteTarget(null);setDeleteCode("");setDeleteError(null);setScreen("betaDataTools");}} style={tileStyle()}>
            <span style={{ ...tileIconStyle, background:PURPLE_LIGHT }}><AlertTriangle size={22} color={PURPLE} /></span>
            <span style={{ flex:1 }}><span style={tileTitleStyle}>Beta data tools</span><span style={tileSubStyle}>Clear simulated logs</span></span>
          </button>
        )}

        {/* Supervisor team selector modal */}
        {showSupAssign && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:20 }}>
            <div style={{ background:"white", borderRadius:20, padding:24, maxWidth:360, width:"100%" }}>
              <div style={{ fontSize:16, fontWeight:700, color:INK, marginBottom:4 }}>My team view</div>
              <div style={{ fontSize:12, color:SLATE, marginBottom:16 }}>Select which teams you want to monitor on your dashboard.</div>
              {["tanker","jetting","watertank"].map((t) => {
                const cur = getSupTeams(session.name);
                const isSel = cur.includes(t);
                return (
                  <button key={t} onClick={() => {
                    const next = isSel ? cur.filter((x)=>x!==t) : [...cur, t];
                    setSupervisorTeamPrefs({ ...supervisorTeamPrefs, [session.name]: next.length ? next : [t] });
                  }} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:12, border: isSel ? `1.5px solid ${teamAccent(t)}` : `1px solid ${BORDER}`, background: isSel ? `${teamAccent(t)}10` : "white", marginBottom:8, cursor:"pointer" }}>
                    <TeamIcon team={t} size={18} color={teamAccent(t)} />
                    <span style={{ flex:1, fontSize:14, fontWeight:600, color:INK }}>{teamLabel(t)}</span>
                    {isSel && <Check size={16} color={teamAccent(t)} strokeWidth={3} />}
                  </button>
                );
              })}
              <PrimaryButton onClick={()=>setShowSupAssign(false)} accent={BLUE}>Done</PrimaryButton>
            </div>
          </div>
        )}

        <div style={{ marginTop:18, fontSize:11, color:SLATE_LIGHT, textAlign:"center" }}>Opsflow · Aimflow Pte Ltd</div>
      </Shell>
    );
  }

  // ── Admin tools sub-menu (admin + supervisor) ────────────────────
  if (screen === "adminTools") {
    const isAdmin = session.role === "admin";
    return (
      <Shell>
        <Header title="Admin tools" onBack={()=>goBack("landing")} accent={PURPLE} />
        <button onClick={()=>setScreen("adminUsers")} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:PURPLE_LIGHT }}><Users size={22} color={PURPLE} /></span>
          <span style={{ flex:1 }}><span style={tileTitleStyle}>Manage users & PINs</span><span style={tileSubStyle}>{isAdmin ? "Add users, reset PINs, revoke access" : "View and edit worker PINs"}</span></span>
        </button>
        <button onClick={()=>{setVehicleEditTarget(null);setNewVehiclePlate("");setNewVehicleTeam((isAdmin?["tanker","jetting","watertank"]:mySupTeams)[0]);setScreen("adminVehicles");}} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:BLUE_LIGHT }}><Truck size={22} color={BLUE} /></span>
          <span style={{ flex:1 }}><span style={tileTitleStyle}>Manage vehicles</span><span style={tileSubStyle}>Add, edit, remove vehicles per team</span></span>
        </button>
        {isAdmin && (
          <button onClick={()=>setScreen("adminSupervisors")} style={tileStyle()}>
            <span style={{ ...tileIconStyle, background:BLUE_LIGHT }}><Users size={22} color={BLUE} /></span>
            <span style={{ flex:1 }}><span style={tileTitleStyle}>Supervisor team assignments</span><span style={tileSubStyle}>Assign supervisors to teams</span></span>
          </button>
        )}
        <button onClick={()=>{setDeleteTarget(null);setDeleteCode("");setDeleteError(null);setDataToolsTeam(null);setScreen("adminDataTools");}} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:RED_LIGHT }}><AlertTriangle size={22} color={RED} /></span>
          <span style={{ flex:1 }}><span style={tileTitleStyle}>Data management</span><span style={tileSubStyle}>Delete live logs — code required</span></span>
        </button>
        <button onClick={()=>{setArchivePassword("");setArchiveError(null);setArchiveSuccess(null);setArchiveTeamFilter(null);setArchiveRangeMode("all");setScreen("archiveTools");}} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:GREEN_LIGHT }}><Archive size={22} color={GREEN_DARK} /></span>
          <span style={{ flex:1 }}><span style={tileTitleStyle}>Archive & reset</span><span style={tileSubStyle}>By team and date range — download, reset, restore</span></span>
        </button>
        {isAdmin && (
          <button onClick={()=>{setNewResetPw("");setScreen("resetPwSettings");}} style={tileStyle()}>
            <span style={{ ...tileIconStyle, background:AMBER_LIGHT }}><KeyRound size={22} color={AMBER} /></span>
            <span style={{ flex:1 }}><span style={tileTitleStyle}>Reset password settings</span><span style={tileSubStyle}>Change the archive reset password</span></span>
          </button>
        )}
      </Shell>
    );
  }

  // ── Supervisor team assignment (admin only) ──────────────────────
  if (screen === "adminSupervisors" && session.role === "admin") {
    const supervisors = userDirectory.filter((u)=>u.role==="supervisor");
    return (
      <Shell>
        <Header title="Supervisor team assignments" onBack={()=>goBack("adminTools")} accent={BLUE} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:16 }}>Assign which teams each supervisor monitors. Supervisors can also self-select from their dashboard.</div>
        {supervisors.map((sup) => {
          const assigned = getSupTeams(sup.name);
          return (
            <div key={sup.name} style={{ border:`1px solid ${BORDER}`, borderRadius:14, padding:"14px", marginBottom:12, background:"white" }}>
              <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:10 }}>{sup.name}</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {["tanker","jetting","watertank"].map((t) => {
                  const isSel = assigned.includes(t);
                  const accent = teamAccent(t);
                  return (
                    <button key={t} onClick={()=>{
                      const next = isSel ? assigned.filter((x)=>x!==t) : [...assigned, t];
                      setSupervisorTeamPrefs({ ...supervisorTeamPrefs, [sup.name]: next.length?next:[t] });
                    }} style={{ padding:"7px 13px", borderRadius:10, border: isSel?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background: isSel?`${accent}15`:"white", color: isSel?accent:SLATE, fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                      {isSel && <Check size={11} strokeWidth={3} />}{teamLabel(t)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Shell>
    );
  }

  // ── Archive tools ────────────────────────────────────────────────
  if (screen === "archiveTools") {
    const isAdmin = session.role === "admin";
    // Supervisors can only archive/reset their own assigned team(s); admin can pick any team or all teams.
    const availableTeams = isAdmin ? ["tanker","jetting","watertank"] : mySupTeams;
    const teamFilter = archiveTeamFilter; // null = all available teams
    const effectiveTeams = teamFilter ? [teamFilter] : availableTeams;

    const totalJobs = jobHistory.filter(j => effectiveTeams.includes(j.team)).length;
    const totalFuel = fuelHistory.filter(f => effectiveTeams.includes(f.team)).length;

    const rangeMode = archiveRangeMode;
    const startTs = archiveRangeStart ? new Date(`${archiveRangeStart}T00:00:00+08:00`).getTime() : -Infinity;
    const endTs = archiveRangeEnd ? new Date(`${archiveRangeEnd}T23:59:59+08:00`).getTime() : Infinity;
    const inRange = (ts) => ts >= startTs && ts <= endTs;
    const inScope = (team) => effectiveTeams.includes(team);
    const previewJobs = (rangeMode === "custom" ? jobHistory.filter(j => inRange(j.checkInTime)) : jobHistory).filter(j => inScope(j.team));
    const previewFuel = (rangeMode === "custom" ? fuelHistory.filter(f => inRange(f.date)) : fuelHistory).filter(f => inScope(f.team));
    const rangeValid = rangeMode === "all" || (archiveRangeStart && archiveRangeEnd && archiveRangeStart <= archiveRangeEnd);

    const setThisMonth = () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
      const last = new Date(now.getFullYear(), now.getMonth()+1, 0).toLocaleDateString("en-CA");
      setArchiveRangeStart(first); setArchiveRangeEnd(last);
    };
    const setLastMonth = () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth()-1, 1).toLocaleDateString("en-CA");
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString("en-CA");
      setArchiveRangeStart(first); setArchiveRangeEnd(last);
    };

    const scopeLabel = teamFilter ? teamLabel(teamFilter) : (isAdmin ? "All teams" : availableTeams.map(teamLabel).join(" + "));

    return (
      <Shell>
        <Header title="Archive & reset" onBack={()=>goBack("adminTools")} accent={GREEN_DARK} />

        {showArchiveConfirm && (
          <ConfirmModal
            title={`Archive ${scopeLabel}?`}
            body={`This saves a snapshot of ${previewJobs.length} job record${previewJobs.length===1?"":"s"} and ${previewFuel.length} fuel record${previewFuel.length===1?"":"s"} for ${scopeLabel}, then permanently removes them from the live app. Other teams' data is not affected. Download a CSV/PDF copy first if you need one outside Opsflow.`}
            confirmLabel="Archive & reset"
            confirmColor={GREEN_DARK}
            icon={Archive}
            onCancel={()=>setShowArchiveConfirm(false)}
            onConfirm={async()=>{
              setShowArchiveConfirm(false);
              await doArchiveReset(archivePassword, rangeMode==="custom"?archiveRangeStart:null, rangeMode==="custom"?archiveRangeEnd:null, teamFilter);
            }}
          />
        )}

        {/* Step 1 — Team scope */}
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>1 · Team</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
          {isAdmin && (
            <button onClick={()=>setArchiveTeamFilter(null)} style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px", borderRadius:12, border: teamFilter===null?`1.5px solid ${GREEN_DARK}`:`1px solid ${BORDER}`, background: teamFilter===null?GREEN_LIGHT:"white", textAlign:"left", cursor:"pointer" }}>
              <Building2 size={17} color={teamFilter===null?GREEN_DARK:SLATE} />
              <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:teamFilter===null?GREEN_DARK:INK }}>All teams</span>
              {teamFilter===null && <Check size={15} color={GREEN_DARK} strokeWidth={3} />}
            </button>
          )}
          {availableTeams.map((t) => {
            const accent = teamAccent(t);
            const isSel = teamFilter === t;
            return (
              <button key={t} onClick={()=>setArchiveTeamFilter(t)} style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px", borderRadius:12, border: isSel?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background: isSel?`${accent}10`:"white", textAlign:"left", cursor:"pointer" }}>
                <TeamIcon team={t} size={17} color={isSel?accent:SLATE} />
                <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:isSel?accent:INK }}>{teamLabel(t)}</span>
                {isSel && <Check size={15} color={accent} strokeWidth={3} />}
              </button>
            );
          })}
        </div>

        {/* Step 2 — Date scope */}
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>2 · Date range</div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <button onClick={()=>setArchiveRangeMode("all")} style={{ flex:1, padding:"11px 8px", borderRadius:11, border: rangeMode==="all"?`1.5px solid ${GREEN_DARK}`:`1px solid ${BORDER}`, background: rangeMode==="all"?GREEN_LIGHT:"white", color: rangeMode==="all"?GREEN_DARK:SLATE, fontSize:13, fontWeight:600, cursor:"pointer" }}>Everything live</button>
          <button onClick={()=>setArchiveRangeMode("custom")} style={{ flex:1, padding:"11px 8px", borderRadius:11, border: rangeMode==="custom"?`1.5px solid ${GREEN_DARK}`:`1px solid ${BORDER}`, background: rangeMode==="custom"?GREEN_LIGHT:"white", color: rangeMode==="custom"?GREEN_DARK:SLATE, fontSize:13, fontWeight:600, cursor:"pointer" }}>Custom range</button>
        </div>

        {rangeMode === "custom" && (
          <>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <button onClick={setThisMonth} style={{ flex:1, padding:9, borderRadius:9, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:12, fontWeight:600, cursor:"pointer" }}>This month</button>
              <button onClick={setLastMonth} style={{ flex:1, padding:9, borderRadius:9, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:12, fontWeight:600, cursor:"pointer" }}>Last month</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>From</div><input type="date" value={archiveRangeStart} onChange={(e)=>setArchiveRangeStart(e.target.value)} style={{ ...datetimeInputStyle, marginBottom:0 }} /></div>
              <div><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>To</div><input type="date" value={archiveRangeEnd} min={archiveRangeStart} onChange={(e)=>setArchiveRangeEnd(e.target.value)} style={{ ...datetimeInputStyle, marginBottom:0 }} /></div>
            </div>
          </>
        )}

        {/* Live preview of what will be archived */}
        <div style={{ border:`1.5px solid ${GREEN_DARK}33`, background:GREEN_LIGHT, borderRadius:13, padding:"13px 14px", marginBottom:20 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:GREEN_DARK, textTransform:"uppercase", letterSpacing:0.4, marginBottom:4 }}>Will archive</div>
          <div style={{ fontSize:15, fontWeight:700, color:INK }}>{scopeLabel}</div>
          <div style={{ fontSize:12.5, color:"#374151", marginTop:2 }}>{previewJobs.length} job{previewJobs.length===1?"":"s"} · {previewFuel.length} fuel record{previewFuel.length===1?"":"s"}</div>
        </div>

        {/* Step 3 — Confirm with password */}
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>3 · Confirm</div>
        <input id="archive-reset-password" name="reset-password" type="password" autoComplete="current-password" value={archivePassword} onChange={(e)=>{setArchivePassword(e.target.value);setArchiveError(null);}} placeholder="Reset password" style={inputStyle} />
        {archiveError && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0 }} /><span>{archiveError}</span></div>}
        {archiveSuccess && <div style={{ display:"flex", gap:8, background:GREEN_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:GREEN_DARK }}><CheckCircle2 size={15} style={{ flexShrink:0 }} /><span>{archiveSuccess}</span></div>}

        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <button onClick={()=>exportJobsCSV(previewJobs)} style={{ flex:1, padding:12, borderRadius:12, border:`1px solid ${BLUE}`, background:"white", color:BLUE, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Download size={14} /> Jobs CSV</button>
          <button onClick={()=>exportFuelCSV(previewFuel)} style={{ flex:1, padding:12, borderRadius:12, border:`1px solid ${AMBER}`, background:"white", color:AMBER_DARK, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Download size={14} /> Fuel CSV</button>
          <button onClick={()=>exportPDF(previewJobs,previewFuel)} style={{ flex:1, padding:12, borderRadius:12, border:`1px solid ${RED}`, background:"white", color:RED, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Download size={14} /> PDF</button>
        </div>

        <PrimaryButton accent={GREEN_DARK} disabled={!archivePassword.trim() || !rangeValid || previewJobs.length+previewFuel.length===0} onClick={()=>setShowArchiveConfirm(true)}>
          <Archive size={16} /> Archive & Reset {scopeLabel}
        </PrimaryButton>

        {archives.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:SLATE, margin:"20px 0 8px", textTransform:"uppercase", letterSpacing:0.5 }}>Past archives</div>
            {archives
              .filter(arc => isAdmin || !arc.team || availableTeams.includes(arc.team))
              .map((arc) => (
              <div key={arc.id} style={{ border:`1px solid ${BORDER}`, borderRadius:13, padding:"13px 14px", marginBottom:10, background:"white" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    {arc.team && <TeamIcon team={arc.team} size={14} color={teamAccent(arc.team)} />}
                    <div style={{ fontSize:14, fontWeight:700, color:INK }}>{arc.label}</div>
                  </div>
                  <div style={{ fontSize:11, color:SLATE_LIGHT }}>{new Date(arc.archivedAt).toLocaleDateString("en-SG")}</div>
                </div>
                <div style={{ fontSize:12, color:SLATE, marginBottom:10 }}>{arc.jobs.length} jobs · {arc.fuel.length} fuel records · archived by {arc.archivedBy}</div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>exportJobsCSV(arc.jobs)} style={{ flex:1, padding:9, borderRadius:9, border:`1px solid ${BLUE}`, background:"white", color:BLUE, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}><Download size={12} /> Jobs</button>
                  <button onClick={()=>exportFuelCSV(arc.fuel)} style={{ flex:1, padding:9, borderRadius:9, border:`1px solid ${AMBER}`, background:"white", color:AMBER_DARK, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}><Download size={12} /> Fuel</button>
                  <button onClick={()=>exportPDF(arc.jobs,arc.fuel)} style={{ flex:1, padding:9, borderRadius:9, border:`1px solid ${RED}`, background:"white", color:RED, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}><Download size={12} /> PDF</button>
                  <button onClick={()=>{setRestoreConfirmTarget(arc);}} style={{ flex:1, padding:9, borderRadius:9, border:`1px solid ${GREEN}`, background:"white", color:GREEN_DARK, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}><RotateCcw size={12} /> Restore</button>
                </div>
                {restoreConfirmTarget?.id === arc.id && (
                  <ConfirmModal
                    title={`Restore ${arc.label}?`}
                    body="This adds these archived records back into the live app, alongside any current data. It does not remove them from the archive."
                    confirmLabel="Restore"
                    confirmColor={GREEN_DARK}
                    icon={RotateCcw}
                    onCancel={()=>setRestoreConfirmTarget(null)}
                    onConfirm={()=>{ restoreArchive(arc); setRestoreConfirmTarget(null); }}
                  />
                )}
              </div>
            ))}
          </>
        )}
      </Shell>
    );
  }

  // ── Reset password settings ──────────────────────────────────────
  if (screen === "resetPwSettings") {
    const isDupe = newResetPw.trim() === resetPassword;
    return (
      <Shell>
        <Header title="Reset password" onBack={()=>goBack("adminTools")} accent={AMBER} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:16 }}>This password is required to archive and reset monthly data. Keep it secure and share only with authorised admins.</div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Current password</div>
        <div style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:"13px 14px", marginBottom:16, background:CANVAS, fontSize:14, fontWeight:700, color:INK, letterSpacing:2 }}>{"•".repeat(resetPassword.length)}</div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>New password</div>
        <input value={newResetPw} onChange={(e)=>setNewResetPw(e.target.value)} placeholder="Enter new reset password" style={inputStyle} />
        {isDupe && newResetPw && <div style={{ fontSize:12, color:AMBER_DARK, marginBottom:10 }}>That's the same as the current password.</div>}
        <PrimaryButton accent={AMBER} disabled={!newResetPw.trim() || isDupe} onClick={()=>{updateSettings({ resetPassword: newResetPw.trim() });setNewResetPw("");setScreen("adminTools");}}>
          <KeyRound size={16} /> Save new password
        </PrimaryButton>
      </Shell>
    );
  }

  // ── Check in / check out team selector ──────────────────────────
  if (screen === "checkinoutTeam") {
    if (myActiveJob) {
      return (
        <Shell>
          <Header title="Job check-in / check-out" onBack={()=>goBack("landing")} />
          <div style={{ border:`1.5px solid ${RED}`, background:RED_LIGHT, borderRadius:16, padding:20, textAlign:"center", marginBottom:16 }}>
            <AlertTriangle size={32} color={RED} style={{ marginBottom:10 }} />
            <div style={{ fontSize:15, fontWeight:700, color:RED, marginBottom:6 }}>Check-out required first</div>
            <div style={{ fontSize:13, color:"#7A2118", lineHeight:1.5, marginBottom:4 }}>You have an active {teamLabel(myActiveJob.team).toLowerCase()} job at <strong>{myActiveJob.jobSite}</strong>.</div>
            <div style={{ fontSize:13, color:"#7A2118", lineHeight:1.5 }}>Please check out before starting a new check-in.</div>
          </div>
          <PrimaryButton accent={RED} onClick={()=>setScreen("checkoutGreet")}><LogOut size={16} /> Go to check-out</PrimaryButton>
          <button onClick={()=>{setLogPersonName(null);setLogTeamFilter(null);setScreen("myJobLog");}} style={{ width:"100%", marginTop:14, padding:12, borderRadius:10, border:"none", background:"transparent", color:BLUE, fontSize:13, fontWeight:600, cursor:"pointer" }}>View my job log →</button>
        </Shell>
      );
    }
    const canPickAnyTeam = isAdminOrSup;
    return (
      <Shell>
        <Header title="Job check-in / check-out" onBack={()=>goBack("landing")} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>Which job are you doing right now?</div>
        {["tanker","jetting","watertank"].map((t) => {
          const allowed = canPickAnyTeam || t===session.team;
          if (!allowed) return (
            <div key={t} style={{ ...tileStyle(), cursor:"not-allowed", opacity:0.55, background:CANVAS }}>
              <span style={{ ...tileIconStyle, background:"white" }}><TeamIcon team={t} color={SLATE_LIGHT} /></span>
              <span><span style={{ ...tileTitleStyle, color:SLATE }}>{teamLabel(t)} job</span><span style={{ ...tileSubStyle, color:SLATE_LIGHT, fontWeight:600 }}>Not authorised — ask a {teamLabel(t)} team member.</span></span>
            </div>
          );
          return (
            <button key={t} onClick={()=>{setDraft({...emptyDraft(),team:t,checker:session.name});setScreen("checkinGps");}} style={tileStyle()}>
              <span style={{ ...tileIconStyle, background:CANVAS }}><TeamIcon team={t} color={teamAccent(t)} /></span>
              <span><span style={tileTitleStyle}>{teamLabel(t)} job</span><span style={tileSubStyle}>{t==="tanker"?"Grease traps, ejector tanks, sump pits":t==="jetting"?"HPWJ flushing, rodding, choke clearing":"Tank cleaning, inspection, water quality"}</span></span>
            </button>
          );
        })}
        <button onClick={()=>{setLogPersonName(null);setLogTeamFilter(null);setScreen("myJobLog");}} style={{ width:"100%", marginTop:14, padding:12, borderRadius:10, border:"none", background:"transparent", color:BLUE, fontSize:13, fontWeight:600, cursor:"pointer" }}>View my job log →</button>
      </Shell>
    );
  }

  if (screen === "checkinGps") {
    return (
      <Shell>
        <Header title="Check in" onBack={()=>goBack("checkinoutTeam")} accent={teamAccent(draft.team)} />
        <ProgressDots step={0} total={3} accent={teamAccent(draft.team)} />
        {isBeta ? (
          <div style={{ padding:"12px 0" }}>
            <div style={{ display:"flex", gap:8, background:PURPLE_LIGHT, borderRadius:11, padding:"10px 12px", marginBottom:16, fontSize:12, color:PURPLE }}><ShieldAlert size={15} style={{ flexShrink:0, marginTop:1 }} /><span>Beta mode — set a manual check-in time to simulate OT scenarios.</span></div>
            <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Simulated check-in date & time</div>
            <input type="datetime-local" value={draft.manualCheckIn} onChange={(e)=>setDraft({...draft,manualCheckIn:e.target.value,gpsCaptured:!!e.target.value})} style={{ ...datetimeInputStyle, marginBottom:18 }} />
            <PrimaryButton accent={PURPLE} disabled={!draft.manualCheckIn} onClick={()=>setScreen("checkinVehicle")}>Continue</PrimaryButton>
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            {!draft.gpsCaptured ? (
              <>
                <MapPin size={40} color={teamAccent(draft.team)} />
                <div style={{ fontSize:15, fontWeight:700, margin:"14px 0 6px" }}>Confirm your location</div>
                <div style={{ fontSize:13, color:SLATE, marginBottom:16 }}>We need your GPS to verify you're on site</div>
                <div style={{ display:"flex", gap:8, background:AMBER_LIGHT, borderRadius:11, padding:"12px 13px", marginBottom:20, fontSize:12, color:AMBER_DARK, textAlign:"left", lineHeight:1.5 }}>
                  <AlertTriangle size={18} style={{ flexShrink:0, marginTop:1 }} />
                  <span><strong>Only check in once you have arrived on site.</strong> Your GPS location and timestamp are recorded. Checking in before arriving is a timestamp violation.</span>
                </div>
                <PrimaryButton accent={teamAccent(draft.team)} onClick={()=>setDraft({...draft,gpsCaptured:true})}><MapPin size={16} /> Share my location</PrimaryButton>
              </>
            ) : (
              <>
                <CheckCircle2 size={40} color={GREEN} />
                <div style={{ fontSize:15, fontWeight:700, margin:"14px 0 20px" }}>Location captured</div>
                <PrimaryButton accent={teamAccent(draft.team)} onClick={()=>setScreen("checkinVehicle")}>Continue</PrimaryButton>
              </>
            )}
          </div>
        )}
      </Shell>
    );
  }

  if (screen === "checkinVehicle") {
    const accent = teamAccent(draft.team);
    const toggleVehicle = (v) => {
      const isSel = draft.vehicles.includes(v);
      const vehicles = isSel ? draft.vehicles.filter((x)=>x!==v) : [...draft.vehicles,v];
      const crewByVehicle = {...draft.crewByVehicle};
      if (isSel) delete crewByVehicle[v];
      else if (!crewByVehicle[v]) crewByVehicle[v]=[]; // crew starts empty — must be explicitly selected, never assumed
      setDraft({...draft,vehicles,crewByVehicle});
    };
    const toggleCrewMember = (vehicle,name) => {
      const current = draft.crewByVehicle[vehicle]||[];
      const updated = current.includes(name)?current.filter((x)=>x!==name):[...current,name];
      // When adding casual labour sentinel, initialise names array with one blank entry
      const crewCustomNames={...draft.crewCustomNames};
      if (name===CASUAL_LABOUR_OPTION && !current.includes(name)) {
        crewCustomNames[vehicle] = crewCustomNames[vehicle]?.length ? crewCustomNames[vehicle] : [""];
      }
      setDraft({...draft,crewByVehicle:{...draft.crewByVehicle,[vehicle]:updated},crewCustomNames});
    };
    const setCasualName=(vehicle,idx,val)=>{
      const arr=[...(draft.crewCustomNames[vehicle]||[""])];
      arr[idx]=val;
      setDraft({...draft,crewCustomNames:{...draft.crewCustomNames,[vehicle]:arr}});
    };
    const addCasualSlot=(vehicle)=>{
      const arr=[...(draft.crewCustomNames[vehicle]||[]),""];
      setDraft({...draft,crewCustomNames:{...draft.crewCustomNames,[vehicle]:arr}});
    };
    const removeCasualSlot=(vehicle,idx)=>{
      const arr=(draft.crewCustomNames[vehicle]||[]).filter((_,i)=>i!==idx);
      // If all slots removed, also deselect the sentinel
      if (!arr.length) {
        const crew=(draft.crewByVehicle[vehicle]||[]).filter((x)=>x!==CASUAL_LABOUR_OPTION);
        setDraft({...draft,crewByVehicle:{...draft.crewByVehicle,[vehicle]:crew},crewCustomNames:{...draft.crewCustomNames,[vehicle]:[]}});
      } else {
        setDraft({...draft,crewCustomNames:{...draft.crewCustomNames,[vehicle]:arr}});
      }
    };
    const setCrewCustomName=(vehicle,val)=>setDraft({...draft,crewCustomNames:{...draft.crewCustomNames,[vehicle]:val}});
    const setVehiclePlate=(vehicle,val)=>setDraft({...draft,vehicleCustomPlates:{...draft.vehicleCustomPlates,[vehicle]:val}});
    const vehicleReady=(v)=>{
      const crew=draft.crewByVehicle[v]||[];
      if (!crew.length) return false;
      if (v==="Others" && !(draft.vehicleCustomPlates[v]||"").trim()) return false;
      if (crew.includes(CASUAL_LABOUR_OPTION)) {
        const names = draft.crewCustomNames[v]||[];
        if (!names.length || names.some((n)=>!n.trim())) return false;
      }
      return true;
    };
    const allCrewAssigned = draft.vehicles.length>0 && draft.vehicles.every(vehicleReady);
    return (
      <Shell>
        <Header title="Vehicle on site" onBack={()=>goBack("checkinGps")} accent={accent} />
        <ProgressDots step={1} total={3} accent={accent} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Select vehicle(s). Use "Others" for another team's vehicle and enter the plate.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
          {teamVehicles(draft.team).map((v) => {
            const isSel = draft.vehicles.includes(v);
            const crewHere = draft.crewByVehicle[v]||[];
            const showOtherNameInput = crewHere.includes(CASUAL_LABOUR_OPTION);
            return (
              <div key={v}>
                <button onClick={()=>toggleVehicle(v)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"13px 14px", borderRadius:isSel?"12px 12px 0 0":12, border:isSel?`1.5px solid ${accent}`:`1px solid ${BORDER}`, borderBottom:isSel?"none":`1px solid ${BORDER}`, background:isSel?`${accent}12`:"white", textAlign:"left", cursor:"pointer", fontSize:14, color:INK }}>
                  <span style={{ width:19, height:19, borderRadius:5, border:`1.5px solid ${isSel?accent:"#D1D5DB"}`, background:isSel?accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{isSel && <Check size={12} color="white" strokeWidth={3} />}</span>
                  <span style={{ flex:1, fontWeight:isSel?600:400 }}>{v}</span>
                </button>
                {isSel && (
                  <div style={{ border:`1.5px solid ${accent}`, borderTop:`1px solid ${accent}33`, borderRadius:"0 0 12px 12px", padding:"11px 13px 13px", background:"white" }}>
                    {v==="Others" && <div style={{ marginBottom:12 }}><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Vehicle plate number</div><input autoFocus placeholder="e.g. GBX1234A" value={draft.vehicleCustomPlates[v]||""} onChange={(e)=>setVehiclePlate(v,e.target.value)} style={{ ...inputStyle, marginBottom:0 }} /></div>}
                    <div style={{ fontSize:11, color:SLATE, marginBottom:8, fontWeight:600 }}>Who's in this vehicle?</div>
                    <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>{teamLabel(draft.team)} team</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                      {teamWorkerOptions(draft.team,userDirectory).own.map((name)=>{
                        const isPicked=crewHere.includes(name);
                        return <button key={name} onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background:isPicked?accent:"white", color:isPicked?"white":"#374151", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked && <Check size={11} strokeWidth={3} />}{name}</button>
                      })}
                    </div>
                    {teamWorkerOptions(draft.team,userDirectory).supervisors.length>0 && <>
                      <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>Supervisors</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                        {teamWorkerOptions(draft.team,userDirectory).supervisors.map((name)=>{
                          const isPicked=crewHere.includes(name);
                          return <button key={name} onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${AMBER_DARK}`:`1px solid ${BORDER}`, background:isPicked?AMBER_DARK:"white", color:isPicked?"white":"#374151", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked && <Check size={11} strokeWidth={3} />}{name}</button>
                        })}
                      </div>
                    </>}
                    {teamWorkerOptions(draft.team,userDirectory).other.length>0 && <>
                      <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>Helping from another team</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                        {teamWorkerOptions(draft.team,userDirectory).other.map((name)=>{
                          const isPicked=crewHere.includes(name);
                          return <button key={name} onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${PURPLE}`:`1px solid ${BORDER}`, background:isPicked?PURPLE:"white", color:isPicked?"white":"#374151", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked && <Check size={11} strokeWidth={3} />}{name}</button>
                        })}
                      </div>
                    </>}
                    <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>External</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 }}>
                      {(()=>{ const name=CASUAL_LABOUR_OPTION; const isPicked=crewHere.includes(name); return <button onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${SLATE}`:`1px dashed #D1D5DB`, background:isPicked?SLATE:"white", color:isPicked?"white":SLATE, fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked && <Check size={11} strokeWidth={3} />}+ Casual labour</button>; })()}
                    </div>
                    {crewHere.includes(CASUAL_LABOUR_OPTION) && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Casual labourer name(s)</div>
                        {(draft.crewCustomNames[v]||[""]).map((name,idx)=>(
                          <div key={idx} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                            <input placeholder={`Name ${idx+1}`} value={name} onChange={(e)=>setCasualName(v,idx,e.target.value)} style={{ ...inputStyle, marginBottom:0, flex:1 }} />
                            {(draft.crewCustomNames[v]||[]).length > 1 && (
                              <button onClick={()=>removeCasualSlot(v,idx)} style={{ border:`1px solid ${RED}`, background:"white", borderRadius:8, padding:"9px 10px", cursor:"pointer", flexShrink:0 }}>
                                <Trash2 size={13} color={RED} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={()=>addCasualSlot(v)} style={{ border:`1px dashed ${BORDER}`, background:"white", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, color:SLATE, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                          <Plus size={13} /> Add another
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <PrimaryButton accent={accent} disabled={!allCrewAssigned} onClick={()=>setScreen("checkinSite")}>Continue</PrimaryButton>
      </Shell>
    );
  }

  if (screen === "checkinSite") {
    const accent = teamAccent(draft.team);
    const isDup = draft.jobSite ? checkDuplicate(draft.team, draft.jobSite) : false;
    return (
      <Shell>
        <Header title="Job site" onBack={()=>goBack("checkinVehicle")} accent={accent} />
        <ProgressDots step={2} total={3} accent={accent} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Where are you right now?</div>
        <input autoFocus placeholder="e.g. Changi Airport T1, Grease Trap B2" value={draft.jobSite||""} onChange={(e)=>setDraft({...draft,jobSite:e.target.value})} style={inputStyle} />
        {isDup && (
          <div style={{ display:"flex", gap:8, background:AMBER_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:AMBER_DARK }}>
            <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }} />
            <span>⚠️ You already have a job logged at this site today. Are you sure this is a different job?</span>
          </div>
        )}
        <PrimaryButton accent={accent} disabled={!draft.jobSite?.trim()} onClick={()=>{
          const checkInTime = nowFn();
          const checkinRecord = { ...draft, checkInTime, id:`active-${Date.now()}` };
          // Resolve crew: replace CASUAL_LABOUR_OPTION sentinel with actual names
          const rawCrew = [...new Set(Object.values(draft.crewByVehicle||{}).flat())];
          const casualNames = Object.values(draft.crewCustomNames||{}).flat().map((n)=>n.trim()).filter(Boolean);
          const allCrew = [...rawCrew.filter((n)=>n!==CASUAL_LABOUR_OPTION), ...casualNames];
          checkinRecord.crew = [...new Set(allCrew)];
          if (isBeta) setBetaActiveJobs((p)=>[...p.filter((j)=>j.checker!==session.name),checkinRecord]);
          else setActiveJob(checkinRecord);
          setDraft(emptyDraft());
          setScreen("checkinDone");
        }}>
          <Check size={16} /> Confirm check-in
        </PrimaryButton>
      </Shell>
    );
  }

  if (screen === "checkinDone") {
    const job = (isBeta?betaActiveJobs:activeJobs).find((j)=>j.checker===session.name);
    const checkInTs = job?.checkInTime || Date.now();
    const dayType = getDayType(checkInTs);
    return (
      <Shell>
        <div style={{ textAlign:"center", padding:"40px 0 20px" }}>
          <CheckCircle2 size={48} color={GREEN} />
          <div style={{ fontSize:16, fontWeight:700, margin:"16px 0 6px" }}>Checked in!</div>
          <div style={{ fontSize:13, color:SLATE, marginBottom:24 }}>
            {new Date(checkInTs).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})} · {dayType}
          </div>
          <PrimaryButton onClick={()=>setScreen("landing")}>Back to home</PrimaryButton>
        </div>
      </Shell>
    );
  }

  // ── Checkout flow ────────────────────────────────────────────────
  if (screen === "checkoutGreet") {
    if (!myActiveJob) { setScreen("landing"); return null; }
    const checkInTs = myActiveJob.checkInTime;
    const hoursNow = (Date.now()-checkInTs)/3600000;
    const isLong = hoursNow > 12;
    return (
      <Shell>
        <Header title="Check out" onBack={()=>goBack("landing")} accent={teamAccent(myActiveJob.team)} />
        <div style={{ border:`1px solid ${BORDER}`, borderRadius:16, padding:18, marginBottom:16, background:"white" }}>
          <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.4 }}>Active job</div>
          <div style={{ fontSize:15, fontWeight:700, color:INK, marginBottom:4 }}>{myActiveJob.jobSite}</div>
          <div style={{ fontSize:12, color:SLATE }}>
            {teamLabel(myActiveJob.team)} · Checked in {new Date(checkInTs).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})} · {elapsed} elapsed
          </div>
        </div>
        {isLong && (
          <div style={{ display:"flex", gap:8, background:AMBER_LIGHT, borderRadius:12, padding:"12px 14px", marginBottom:16, fontSize:12, color:AMBER_DARK }}>
            <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }} />
            <span>⚠️ This job has exceeded 12 hours. Your supervisor and admin have been notified.</span>
          </div>
        )}
        <PrimaryButton accent={teamAccent(myActiveJob.team)} onClick={()=>setScreen("checkoutDetails")}><LogOut size={16} /> Start check-out</PrimaryButton>
        <button onClick={()=>setScreen("landing")} style={{ width:"100%", padding:13, borderRadius:12, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:13, fontWeight:600, cursor:"pointer" }}>Not yet — go back</button>
      </Shell>
    );
  }

  if (screen === "checkoutDetails") {
    if (!myActiveJob) { setScreen("landing"); return null; }
    const accent = teamAccent(myActiveJob.team);
    const isJetting = myActiveJob.team==="jetting";
    const isTanker = myActiveJob.team==="tanker";
    const lines = checkoutDraft.serviceLines;
    const addLine = ()=>setCheckoutDraft({...checkoutDraft,serviceLines:[...lines,{type:"",qty:"",freq:"",levels:[],detail:""}]});
    const removeLine=(i)=>setCheckoutDraft({...checkoutDraft,serviceLines:lines.filter((_,idx)=>idx!==i)});
    const pickType=(i,type)=>{ const u=[...lines]; u[i]={...u[i],type}; setCheckoutDraft({...checkoutDraft,serviceLines:u}); };
    const pickFreq=(i,freq)=>{ const u=[...lines]; u[i]={...u[i],freq}; setCheckoutDraft({...checkoutDraft,serviceLines:u}); };
    const setQty=(i,qty)=>{ const u=[...lines]; u[i]={...u[i],qty}; setCheckoutDraft({...checkoutDraft,serviceLines:u}); };
    const setDetail=(i,detail)=>{ const u=[...lines]; u[i]={...u[i],detail}; setCheckoutDraft({...checkoutDraft,serviceLines:u}); };
    const toggleLevel=(i,lvl)=>{ const u=[...lines]; const cur=u[i].levels||[]; u[i]={...u[i],levels:cur.includes(lvl)?cur.filter((x)=>x!==lvl):[...cur,lvl]}; setCheckoutDraft({...checkoutDraft,serviceLines:u}); };
    const valid = lines.every((l)=>{
      if (!l.type) return false;
      if (isJetting) return l.detail.trim();
      if (l.type === "Others") return l.qty && l.freq && l.detail.trim();
      if (isTanker) return l.qty && l.freq && l.levels && l.levels.length > 0;
      return l.qty && l.freq;
    });
    return (
      <Shell>
        <Header title="Servicing details" onBack={()=>goBack("checkoutGreet")} accent={accent} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>What did you do on site?</div>
        {lines.map((line,i)=>(
          <div key={i} style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:13, marginBottom:10, background:"white" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:SLATE }}>Service line {i+1}</div>
              {lines.length>1 && <button onClick={()=>removeLine(i)} style={{ border:"none", background:"none", color:RED, cursor:"pointer", fontSize:12, fontWeight:600 }}>Remove</button>}
            </div>
            <div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Type of service</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
              {teamServicing(myActiveJob.team).map((opt)=>(
                <button key={opt} onClick={()=>pickType(i,opt)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:10, border:line.type===opt?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background:line.type===opt?`${accent}12`:"white", textAlign:"left", cursor:"pointer", fontSize:13, color:INK }}>
                  <span style={{ width:16, height:16, borderRadius:"50%", border:`1.5px solid ${line.type===opt?accent:"#D1D5DB"}`, background:line.type===opt?accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{line.type===opt && <Check size={10} color="white" strokeWidth={3} />}</span>
                  {opt}
                </button>
              ))}
            </div>
            {isJetting ? (
              <><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Work details / location</div><input value={line.detail} onChange={(e)=>setDetail(i,e.target.value)} placeholder="e.g. Kitchen drain, 40m run" style={{ ...inputStyle, marginBottom:0 }} /></>
            ) : (
              <>
                {isTanker && line.type && line.type!=="Others" && (<><div style={{ fontSize:11, color:SLATE, marginBottom:8, fontWeight:600 }}>Floor levels serviced</div><div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>{TANKER_LEVELS.map((lvl)=>{ const sel=line.levels?.includes(lvl); return <button key={lvl} onClick={()=>toggleLevel(i,lvl)} style={{ padding:"6px 12px", borderRadius:8, border:sel?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background:sel?accent:"white", color:sel?"white":INK, fontSize:13, fontWeight:600, cursor:"pointer" }}>{lvl}</button>; })}</div></>)}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Qty</div><input type="number" min="1" value={line.qty} onChange={(e)=>setQty(i,e.target.value)} placeholder="e.g. 3" style={{ ...inputStyle, marginBottom:0 }} /></div>
                  <div><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Frequency</div>
                    <select value={line.freq} onChange={(e)=>pickFreq(i,e.target.value)} style={{ ...inputStyle, marginBottom:0, cursor:"pointer" }}>
                      <option value="">— Select —</option>
                      {FREQUENCY.map((f)=><option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                {line.type==="Others" && <><div style={{ fontSize:11, color:SLATE, marginBottom:6, marginTop:10, fontWeight:600 }}>Details</div><input value={line.detail} onChange={(e)=>setDetail(i,e.target.value)} placeholder="Describe the service" style={{ ...inputStyle, marginBottom:0 }} /></>}
              </>
            )}
          </div>
        ))}
        <button onClick={addLine} style={{ width:"100%", padding:12, borderRadius:12, border:`1.5px dashed ${BORDER}`, background:"white", color:SLATE, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><Plus size={16} /> Add another service</button>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Jobsheet number</div>
        <input value={checkoutDraft.jobsheet} onChange={(e)=>setCheckoutDraft({...checkoutDraft,jobsheet:e.target.value})} placeholder="e.g. JS-20240915-001" style={inputStyle} />
        {!isJetting && <><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>PUB disposal number</div><input value={checkoutDraft.pubDisposal} onChange={(e)=>setCheckoutDraft({...checkoutDraft,pubDisposal:e.target.value})} placeholder="e.g. PD-2024-0087" style={inputStyle} /></>}
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Remarks (optional)</div>
        <input value={checkoutDraft.remarks} onChange={(e)=>setCheckoutDraft({...checkoutDraft,remarks:e.target.value})} placeholder="Any notes for the supervisor" style={{ ...inputStyle, marginBottom:18 }} />
        {isBeta && <><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Simulated check-out time</div><input type="datetime-local" value={checkoutDraft.manualCheckOut} onChange={(e)=>setCheckoutDraft({...checkoutDraft,manualCheckOut:e.target.value})} style={datetimeInputStyle} /></>}
        <PrimaryButton accent={accent} disabled={!valid} onClick={()=>setScreen("checkoutReview")}>Review & confirm</PrimaryButton>
      </Shell>
    );
  }

  if (screen === "checkoutReview") {
    if (!myActiveJob) { setScreen("landing"); return null; }
    const accent = teamAccent(myActiveJob.team);
    const isJetting = myActiveJob.team==="jetting";
    const checkOutTime = checkoutNowFn();
    const hours = ((checkOutTime-myActiveJob.checkInTime)/3600000).toFixed(2);
    const isLong = parseFloat(hours) > 12;
    const serviceSummary = checkoutDraft.serviceLines.map((l)=>`${l.type}${l.qty?` ×${l.qty}`:""}${l.freq?` (${l.freq})`:""}${l.detail?` — ${l.detail}`:""}`).join("; ");
    return (
      <Shell>
        <Header title="Review check-out" onBack={()=>goBack("checkoutDetails")} accent={accent} />
        {isLong && <div style={{ display:"flex", gap:8, background:AMBER_LIGHT, borderRadius:12, padding:"12px 14px", marginBottom:14, fontSize:12, color:AMBER_DARK }}><AlertTriangle size={16} style={{ flexShrink:0 }} /><span>⚠️ This job exceeded 12 hours ({hours} hrs). Supervisor and admin will be flagged.</span></div>}
        <ReviewBlock rows={[
          ["Site", myActiveJob.jobSite],
          ["Personnel credited", (myActiveJob.crew||[]).join(", ")||"—"],
          ["Services", serviceSummary],
          ["Jobsheet #", checkoutDraft.jobsheet],
          ...(!isJetting ? [["PUB disposal #", checkoutDraft.pubDisposal]] : []),
          ["Remarks", checkoutDraft.remarks||"NIL"],
          ["Hours on site", `${hours} hrs`],
        ]} />
        <PrimaryButton accent={accent} onClick={()=>{
          const completed = {
            id:`job-${Date.now()}`, team:myActiveJob.team, jobSite:myActiveJob.jobSite, checker:myActiveJob.checker,
            checkInTime:myActiveJob.checkInTime, checkOutTime, hours,
            vehicles:myActiveJob.vehicles||[], crew:myActiveJob.crew||[],
            crewByVehicle:myActiveJob.crewByVehicle||{},
            serviceLines:checkoutDraft.serviceLines, jobsheet:checkoutDraft.jobsheet,
            pubDisposal:checkoutDraft.pubDisposal, remarks:checkoutDraft.remarks,
          };
          if (isBeta) { setBetaJobHistory((p)=>[completed,...p]); setBetaActiveJobs((p)=>p.filter((j)=>j.checker!==session.name)); }
          else { addJob(completed); clearActiveJob(session.name); }
          setDraft(emptyDraft()); setCheckoutDraft(emptyCheckout());
          setScreen("checkoutDone");
        }}>
          <Check size={16} /> Confirm check-out
        </PrimaryButton>
      </Shell>
    );
  }

  if (screen === "checkoutDone") {
    const lastJob = (isBeta ? betaJobHistory : jobHistory)[0];
    const serviceSummary = (lastJob?.serviceLines||[]).map((l)=>`${l.type}${l.qty?` ×${l.qty}`:""}${l.freq?` (${l.freq})`:""}`).join(" · ");
    return (
      <Shell>
        <div style={{ textAlign:"center", padding:"32px 0 20px" }}>
          <CheckCircle2 size={48} color={GREEN} />
          <div style={{ fontSize:16, fontWeight:700, margin:"14px 0 4px" }}>Checked out</div>
          <div style={{ fontSize:13, color:SLATE, marginBottom:20 }}>Job closed and hours logged</div>
        </div>
        {lastJob && (
          <div style={{ border:`1px solid ${BORDER}`, borderRadius:16, background:"white", overflow:"hidden", marginBottom:20 }}>
            <div style={{ padding:"13px 16px", borderBottom:`1px solid ${BORDER}`, background:CANVAS }}>
              <div style={{ fontSize:11, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:0.4, marginBottom:4 }}>Job summary</div>
              <div style={{ fontSize:15, fontWeight:700, color:INK }}>{lastJob.jobSite}</div>
              <div style={{ fontSize:12, color:SLATE, marginTop:2 }}>
                {new Date(lastJob.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
                {" – "}{new Date(lastJob.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
                {" · "}{lastJob.hours} hrs
              </div>
            </div>
            {serviceSummary && (
              <div style={{ padding:"11px 16px", borderBottom:`1px solid ${BORDER}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:SLATE_LIGHT, textTransform:"uppercase", letterSpacing:0.3, marginBottom:4 }}>Services</div>
                <div style={{ fontSize:13, color:INK }}>{serviceSummary}</div>
              </div>
            )}
            {lastJob.crew?.length > 0 && (
              <div style={{ padding:"11px 16px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:SLATE_LIGHT, textTransform:"uppercase", letterSpacing:0.3, marginBottom:6 }}>Personnel</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {lastJob.crew.map((name)=>(
                    <span key={name} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:7, background:BLUE_LIGHT, color:BLUE_DARK }}><Users size={11} />{name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <PrimaryButton onClick={()=>setScreen("landing")}>Back to home</PrimaryButton>
      </Shell>
    );
  }

  // ── File a missed check-in ───────────────────────────────────────
  if (screen === "filedTeam") {
    return (
      <Shell>
        <Header title="File a missed check-in" onBack={()=>goBack("landing")} accent="#C2570C" />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>Which job was this for?</div>
        {["tanker","jetting","watertank"].map((t)=>{
          const allowed = isAdminOrSup || t===session.team;
          if (!allowed) return <div key={t} style={{ ...tileStyle(), cursor:"not-allowed", opacity:0.55, background:CANVAS }}><span style={{ ...tileIconStyle, background:"white" }}><TeamIcon team={t} color={SLATE_LIGHT} /></span><span><span style={{ ...tileTitleStyle, color:SLATE }}>{teamLabel(t)} job</span><span style={{ ...tileSubStyle, color:SLATE_LIGHT, fontWeight:600 }}>Not authorised</span></span></div>;
          return <button key={t} onClick={()=>{setFiledDraft({...emptyFiledDraft(),team:t});setScreen("filedTimes");}} style={tileStyle()}><span style={{ ...tileIconStyle, background:CANVAS }}><TeamIcon team={t} color={teamAccent(t)} /></span><span style={tileTitleStyle}>{teamLabel(t)} job</span></button>;
        })}
      </Shell>
    );
  }

  if (screen === "filedTimes" && filedDraft) {
    const valid = filedDraft.manualCheckIn && filedDraft.manualCheckOut && new Date(filedDraft.manualCheckOut)>new Date(filedDraft.manualCheckIn);
    return (
      <Shell>
        <Header title="Date & time" onBack={()=>goBack("filedTeam")} accent="#C2570C" />
        <div style={{ display:"flex", gap:8, background:"#FEF0E6", borderRadius:11, padding:"11px 13px", marginBottom:18, fontSize:12, color:"#7C3D08", lineHeight:1.5 }}>
          <FileClock size={16} style={{ flexShrink:0, marginTop:1 }} />
          <span>No GPS for filed entries — enter the actual date and time you were on site. This will be reviewed before it counts toward your hours.</span>
        </div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Check-in date & time</div>
        <input type="datetime-local" value={filedDraft.manualCheckIn} onChange={(e)=>setFiledDraft({...filedDraft,manualCheckIn:e.target.value})} style={datetimeInputStyle} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Check-out date & time</div>
        <input type="datetime-local" value={filedDraft.manualCheckOut} onChange={(e)=>setFiledDraft({...filedDraft,manualCheckOut:e.target.value})} style={{ ...datetimeInputStyle, marginBottom:18 }} />
        <PrimaryButton accent="#C2570C" disabled={!valid} onClick={()=>setScreen("filedVehicle")}>Continue</PrimaryButton>
      </Shell>
    );
  }

  if (screen === "filedVehicle" && filedDraft) {
    const accent="#C2570C";
    const toggleVehicle=(v)=>{ const isSel=filedDraft.vehicles.includes(v); const vehicles=isSel?filedDraft.vehicles.filter((x)=>x!==v):[...filedDraft.vehicles,v]; const crewByVehicle={...filedDraft.crewByVehicle}; if(isSel)delete crewByVehicle[v]; else if(!crewByVehicle[v])crewByVehicle[v]=[]; setFiledDraft({...filedDraft,vehicles,crewByVehicle}); };
    const toggleCrewMember=(vehicle,name)=>{ const current=filedDraft.crewByVehicle[vehicle]||[]; const updated=current.includes(name)?current.filter((x)=>x!==name):[...current,name]; const crewCustomNames={...filedDraft.crewCustomNames}; if(name===CASUAL_LABOUR_OPTION&&!current.includes(name)){crewCustomNames[vehicle]=crewCustomNames[vehicle]?.length?crewCustomNames[vehicle]:[""];} setFiledDraft({...filedDraft,crewByVehicle:{...filedDraft.crewByVehicle,[vehicle]:updated},crewCustomNames}); };
    const setFiledCasualName=(vehicle,idx,val)=>{ const arr=[...(filedDraft.crewCustomNames[vehicle]||[""])]; arr[idx]=val; setFiledDraft({...filedDraft,crewCustomNames:{...filedDraft.crewCustomNames,[vehicle]:arr}}); };
    const addFiledCasualSlot=(vehicle)=>{ const arr=[...(filedDraft.crewCustomNames[vehicle]||[]),""]; setFiledDraft({...filedDraft,crewCustomNames:{...filedDraft.crewCustomNames,[vehicle]:arr}}); };
    const removeFiledCasualSlot=(vehicle,idx)=>{ const arr=(filedDraft.crewCustomNames[vehicle]||[]).filter((_,i)=>i!==idx); if(!arr.length){const crew=(filedDraft.crewByVehicle[vehicle]||[]).filter((x)=>x!==CASUAL_LABOUR_OPTION);setFiledDraft({...filedDraft,crewByVehicle:{...filedDraft.crewByVehicle,[vehicle]:crew},crewCustomNames:{...filedDraft.crewCustomNames,[vehicle]:[]}});}else{setFiledDraft({...filedDraft,crewCustomNames:{...filedDraft.crewCustomNames,[vehicle]:arr}});} };
    const setCrewCustomName=(vehicle,val)=>setFiledDraft({...filedDraft,crewCustomNames:{...filedDraft.crewCustomNames,[vehicle]:val}});
    const setVehiclePlate=(vehicle,val)=>setFiledDraft({...filedDraft,vehicleCustomPlates:{...filedDraft.vehicleCustomPlates,[vehicle]:val}});
    const vehicleReady=(v)=>{ const crew=filedDraft.crewByVehicle[v]||[]; if(!crew.length)return false; if(v==="Others"&&!(filedDraft.vehicleCustomPlates[v]||"").trim())return false; if(crew.includes(CASUAL_LABOUR_OPTION)){const names=filedDraft.crewCustomNames[v]||[];if(!names.length||names.some((n)=>!n.trim()))return false;} return true; };
    const allCrewAssigned=filedDraft.vehicles.length>0&&filedDraft.vehicles.every(vehicleReady);
    return (
      <Shell>
        <Header title="Vehicle on site" onBack={()=>goBack("filedTimes")} accent={accent} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Select vehicle(s)</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
          {teamVehicles(filedDraft.team).map((v)=>{
            const isSel=filedDraft.vehicles.includes(v); const crewHere=filedDraft.crewByVehicle[v]||[]; const showOtherNameInput=crewHere.includes(CASUAL_LABOUR_OPTION);
            return (
              <div key={v}>
                <button onClick={()=>toggleVehicle(v)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"13px 14px", borderRadius:isSel?"12px 12px 0 0":12, border:isSel?`1.5px solid ${accent}`:`1px solid ${BORDER}`, borderBottom:isSel?"none":`1px solid ${BORDER}`, background:isSel?`${accent}12`:"white", textAlign:"left", cursor:"pointer", fontSize:14, color:INK }}>
                  <span style={{ width:19, height:19, borderRadius:5, border:`1.5px solid ${isSel?accent:"#D1D5DB"}`, background:isSel?accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{isSel&&<Check size={12} color="white" strokeWidth={3} />}</span>
                  <span style={{ flex:1, fontWeight:isSel?600:400 }}>{v}</span>
                </button>
                {isSel && (
                  <div style={{ border:`1.5px solid ${accent}`, borderTop:`1px solid ${accent}33`, borderRadius:"0 0 12px 12px", padding:"11px 13px 13px", background:"white" }}>
                    {v==="Others"&&<div style={{ marginBottom:12 }}><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Vehicle plate number</div><input autoFocus placeholder="e.g. GBX1234A" value={filedDraft.vehicleCustomPlates[v]||""} onChange={(e)=>setVehiclePlate(v,e.target.value)} style={{ ...inputStyle, marginBottom:0 }} /></div>}
                    <div style={{ fontSize:11, color:SLATE, marginBottom:8, fontWeight:600 }}>Who's in this vehicle?</div>
                    <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>{teamLabel(filedDraft.team)} team</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                      {teamWorkerOptions(filedDraft.team,userDirectory).own.map((name)=>{ const isPicked=crewHere.includes(name); return <button key={name} onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background:isPicked?accent:"white", color:isPicked?"white":"#374151", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked&&<Check size={11} strokeWidth={3} />}{name}</button>; })}
                    </div>
                    {teamWorkerOptions(filedDraft.team,userDirectory).supervisors.length>0 && <>
                      <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>Supervisors</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                        {teamWorkerOptions(filedDraft.team,userDirectory).supervisors.map((name)=>{ const isPicked=crewHere.includes(name); return <button key={name} onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${AMBER_DARK}`:`1px solid ${BORDER}`, background:isPicked?AMBER_DARK:"white", color:isPicked?"white":"#374151", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked&&<Check size={11} strokeWidth={3} />}{name}</button>; })}
                      </div>
                    </>}
                    {teamWorkerOptions(filedDraft.team,userDirectory).other.length>0 && <>
                      <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>Other teams / helpers</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                        {teamWorkerOptions(filedDraft.team,userDirectory).other.map((name)=>{ const isPicked=crewHere.includes(name); return <button key={name} onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${PURPLE}`:`1px solid ${BORDER}`, background:isPicked?PURPLE:"white", color:isPicked?"white":"#374151", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked&&<Check size={11} strokeWidth={3} />}{name}</button>; })}
                      </div>
                    </>}
                    <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:0.3, marginBottom:5 }}>External</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 }}>
                      {(()=>{ const name=CASUAL_LABOUR_OPTION; const isPicked=crewHere.includes(name); return <button onClick={()=>toggleCrewMember(v,name)} style={{ padding:"7px 12px", borderRadius:8, border:isPicked?`1.5px solid ${SLATE}`:`1px dashed #D1D5DB`, background:isPicked?SLATE:"white", color:isPicked?"white":SLATE, fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>{isPicked&&<Check size={11} strokeWidth={3} />}+ Casual labour</button>; })()}
                    </div>
                    {crewHere.includes(CASUAL_LABOUR_OPTION) && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Casual labourer name(s)</div>
                        {(filedDraft.crewCustomNames[v]||[""]).map((cname,idx)=>(
                          <div key={idx} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                            <input placeholder={`Name ${idx+1}`} value={cname} onChange={(e)=>setFiledCasualName(v,idx,e.target.value)} style={{ ...inputStyle, marginBottom:0, flex:1 }} />
                            {(filedDraft.crewCustomNames[v]||[]).length > 1 && (
                              <button onClick={()=>removeFiledCasualSlot(v,idx)} style={{ border:`1px solid ${RED}`, background:"white", borderRadius:8, padding:"9px 10px", cursor:"pointer", flexShrink:0 }}>
                                <Trash2 size={13} color={RED} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={()=>addFiledCasualSlot(v)} style={{ border:`1px dashed ${BORDER}`, background:"white", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, color:SLATE, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                          <Plus size={13} /> Add another
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <PrimaryButton accent={accent} disabled={!allCrewAssigned} onClick={()=>setScreen("filedSite")}>Continue</PrimaryButton>
      </Shell>
    );
  }

  if (screen === "filedSite" && filedDraft) {
    return (
      <Shell>
        <Header title="Job site" onBack={()=>goBack("filedVehicle")} accent="#C2570C" />
        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Where was this job?</div>
        <input autoFocus placeholder="e.g. Changi Airport T1, Grease Trap B2" value={filedDraft.jobSite} onChange={(e)=>setFiledDraft({...filedDraft,jobSite:e.target.value})} style={{ ...inputStyle, marginBottom:18 }} />
        <PrimaryButton accent="#C2570C" disabled={!filedDraft.jobSite.trim()} onClick={()=>setScreen("filedService")}>Continue</PrimaryButton>
      </Shell>
    );
  }

  if (screen === "filedService" && filedDraft) {
    const accent="#C2570C"; const lines=filedDraft.serviceLines; const team=filedDraft.team; const isJetting=team==="jetting"; const isTanker=team==="tanker";
    const addLine=()=>setFiledDraft({...filedDraft,serviceLines:[...lines,{type:"",qty:"",freq:"",levels:[],detail:""}]});
    const removeLine=(i)=>setFiledDraft({...filedDraft,serviceLines:lines.filter((_,idx)=>idx!==i)});
    const pickType=(i,type)=>{ const u=[...lines]; u[i]={...u[i],type}; setFiledDraft({...filedDraft,serviceLines:u}); };
    const pickFreq=(i,freq)=>{ const u=[...lines]; u[i]={...u[i],freq}; setFiledDraft({...filedDraft,serviceLines:u}); };
    const setQty=(i,qty)=>{ const u=[...lines]; u[i]={...u[i],qty}; setFiledDraft({...filedDraft,serviceLines:u}); };
    const setDetail=(i,detail)=>{ const u=[...lines]; u[i]={...u[i],detail}; setFiledDraft({...filedDraft,serviceLines:u}); };
    const toggleLevel=(i,lvl)=>{ const u=[...lines]; const cur=u[i].levels||[]; u[i]={...u[i],levels:cur.includes(lvl)?cur.filter((x)=>x!==lvl):[...cur,lvl]}; setFiledDraft({...filedDraft,serviceLines:u}); };
    const valid=lines.every((l)=>{
      if (!l.type) return false;
      if (isJetting) return l.detail.trim();
      if (l.type === "Others") return l.qty && l.freq && l.detail.trim(); // Others needs description
      if (isTanker) return l.qty && l.freq && l.levels && l.levels.length > 0;
      return l.qty && l.freq;
    });
    return (
      <Shell>
        <Header title="Servicing details" onBack={()=>goBack("filedSite")} accent={accent} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>What did you do on site?</div>
        {lines.map((line,i)=>(
          <div key={i} style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:13, marginBottom:10, background:"white" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}><div style={{ fontSize:12, fontWeight:700, color:SLATE }}>Service line {i+1}</div>{lines.length>1&&<button onClick={()=>removeLine(i)} style={{ border:"none", background:"none", color:RED, cursor:"pointer", fontSize:12, fontWeight:600 }}>Remove</button>}</div>
            <div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Type of service</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
              {teamServicing(team).map((opt)=><button key={opt} onClick={()=>pickType(i,opt)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:10, border:line.type===opt?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background:line.type===opt?`${accent}12`:"white", textAlign:"left", cursor:"pointer", fontSize:13, color:INK }}><span style={{ width:16, height:16, borderRadius:"50%", border:`1.5px solid ${line.type===opt?accent:"#D1D5DB"}`, background:line.type===opt?accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{line.type===opt&&<Check size={10} color="white" strokeWidth={3} />}</span>{opt}</button>)}
            </div>
            {isJetting ? (
              <><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Work details</div><input value={line.detail} onChange={(e)=>setDetail(i,e.target.value)} placeholder="e.g. Kitchen drain, 40m run" style={{ ...inputStyle, marginBottom:0 }} /></>
            ) : (
              <>
                {/* Floor levels — tanker only, not for "Others" */}
                {isTanker && line.type && line.type !== "Others" && (
                  <>
                    <div style={{ fontSize:11, color:SLATE, marginBottom:8, fontWeight:600 }}>Floor levels serviced</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                      {TANKER_LEVELS.map((lvl)=>{ const sel=line.levels?.includes(lvl); return <button key={lvl} onClick={()=>toggleLevel(i,lvl)} style={{ padding:"6px 12px", borderRadius:8, border:sel?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background:sel?accent:"white", color:sel?"white":INK, fontSize:13, fontWeight:600, cursor:"pointer" }}>{lvl}</button>; })}
                    </div>
                  </>
                )}
                {/* Qty and frequency — all non-jetting */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Qty</div><input type="number" min="1" value={line.qty} onChange={(e)=>setQty(i,e.target.value)} placeholder="e.g. 3" style={{ ...inputStyle, marginBottom:0 }} /></div>
                  <div><div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Frequency</div><select value={line.freq} onChange={(e)=>pickFreq(i,e.target.value)} style={{ ...inputStyle, marginBottom:0, cursor:"pointer" }}><option value="">— Select —</option>{FREQUENCY.map((f)=><option key={f} value={f}>{f}</option>)}</select></div>
                </div>
                {/* Description — required for "Others" type */}
                {line.type === "Others" && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:11, color:SLATE, marginBottom:6, fontWeight:600 }}>Describe the service <span style={{ color:RED }}>*</span></div>
                    <input value={line.detail} onChange={(e)=>setDetail(i,e.target.value)} placeholder="e.g. Chemical dosing, pump maintenance…" style={{ ...inputStyle, marginBottom:0 }} />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <button onClick={addLine} style={{ width:"100%", padding:12, borderRadius:12, border:`1.5px dashed ${BORDER}`, background:"white", color:SLATE, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><Plus size={16} /> Add another service</button>
        <PrimaryButton accent={accent} disabled={!valid} onClick={()=>setScreen("filedJobsheet")}>Continue</PrimaryButton>
      </Shell>
    );
  }

  if (screen === "filedJobsheet" && filedDraft) {
    const isJetting = filedDraft.team==="jetting";
    return (
      <Shell>
        <Header title="Job details" onBack={()=>goBack("filedService")} accent="#C2570C" />
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Jobsheet number</div>
        <input value={filedDraft.jobsheet||""} onChange={(e)=>setFiledDraft({...filedDraft,jobsheet:e.target.value})} placeholder="e.g. JS-20240915-001" style={inputStyle} />
        {!isJetting&&<><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>PUB disposal number</div><input value={filedDraft.pubDisposal||""} onChange={(e)=>setFiledDraft({...filedDraft,pubDisposal:e.target.value})} placeholder="e.g. PD-2024-0087" style={inputStyle} /></>}
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Remarks (optional)</div>
        <input value={filedDraft.remarks||""} onChange={(e)=>setFiledDraft({...filedDraft,remarks:e.target.value})} placeholder="Any notes" style={inputStyle} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Reason for filing (required)</div>
        <input value={filedDraft.reason||""} onChange={(e)=>setFiledDraft({...filedDraft,reason:e.target.value})} placeholder="e.g. Phone died, forgot to check in on arrival" style={{ ...inputStyle, marginBottom:18 }} />
        <PrimaryButton accent="#C2570C" disabled={!filedDraft.reason?.trim()} onClick={()=>setScreen("filedReview")}>Continue</PrimaryButton>
      </Shell>
    );
  }

  if (screen === "filedReview" && filedDraft) {
    const checkInMs = new Date(filedDraft.manualCheckIn).getTime();
    const checkOutMs = new Date(filedDraft.manualCheckOut).getTime();
    const hours = ((checkOutMs-checkInMs)/3600000).toFixed(2);
    const ot = calcOT(checkInMs,checkOutMs);
    const allCrew = [...new Set([
      ...Object.values(filedDraft.crewByVehicle||{}).flat().filter((n)=>n!==CASUAL_LABOUR_OPTION),
      ...Object.values(filedDraft.crewCustomNames||{}).flat().map((n)=>n.trim()).filter(Boolean),
    ])];
    // The person(s) actually on site are whoever was selected under vehicles/crew —
    // NOT necessarily the person filing this entry. "checker" is just the primary
    // name shown in lists; full credit for hours/OT goes to everyone in allCrew.
    const primaryPerson = allCrew[0] || session.name;
    const noOneSelected = allCrew.length === 0;
    return (
      <Shell>
        <Header title="Review filed entry" onBack={()=>goBack("filedJobsheet")} accent="#C2570C" />
        <div style={{ display:"flex", gap:8, background:"#FEF0E6", borderRadius:12, padding:"12px 14px", marginBottom:16, fontSize:12, color:"#7C3D08" }}>
          <FileClock size={16} style={{ flexShrink:0, marginTop:1 }} />
          <span>Once submitted, a supervisor will review this entry before it counts toward the hours of everyone selected under vehicles/crew.</span>
        </div>
        {noOneSelected && (
          <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:12, padding:"12px 14px", marginBottom:16, fontSize:12, color:RED }}>
            <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }} />
            <span>No personnel selected. Go back and select who was actually on site — this entry will not count toward anyone's hours until someone is selected.</span>
          </div>
        )}
        <ReviewBlock rows={[
          ["Team", teamLabel(filedDraft.team)],
          ["Site", filedDraft.jobSite],
          ["Check-in", new Date(checkInMs).toLocaleString("en-SG",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})],
          ["Check-out", new Date(checkOutMs).toLocaleString("en-SG",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})],
          ["Hours", `${hours} hrs (${ot.toFixed(1)} OT each)`],
          ["Personnel credited", allCrew.join(", ")||"None selected"],
          ["Filed by", session.name],
          ["Reason", filedDraft.reason],
        ]} />
        <PrimaryButton accent="#C2570C" disabled={noOneSelected} onClick={()=>{
          const entry = {
            id:`filed-${Date.now()}`, team:filedDraft.team,
            checker: primaryPerson,         // primary name shown in lists/cards
            filedBy: session.name,          // who actually submitted this filing
            jobSite:filedDraft.jobSite,
            checkInTime:new Date(filedDraft.manualCheckIn).getTime(),
            checkOutTime:new Date(filedDraft.manualCheckOut).getTime(),
            hours, vehicles:filedDraft.vehicles, crew:allCrew,
            crewByVehicle:filedDraft.crewByVehicle,
            serviceLines:filedDraft.serviceLines,
            jobsheet:filedDraft.jobsheet||"", pubDisposal:filedDraft.pubDisposal||"",
            remarks:filedDraft.remarks||"", reason:filedDraft.reason,
            status:"pending", filedAt:Date.now(), originalDraft:filedDraft,
          };
          addFiledEntry(entry);
          setFiledDraft(null);
          setScreen("filedDone");
        }}>
          <FileClock size={16} /> Submit for approval
        </PrimaryButton>
      </Shell>
    );
  }

  if (screen === "filedDone") {
    return (
      <Shell>
        <div style={{ textAlign:"center", padding:"40px 0" }}>
          <FileClock size={48} color="#C2570C" />
          <div style={{ fontSize:16, fontWeight:700, margin:"16px 0 6px" }}>Filed for review</div>
          <div style={{ fontSize:13, color:SLATE, marginBottom:8 }}>Your supervisor will review this entry.</div>
          <div style={{ fontSize:12, color:SLATE_LIGHT, marginBottom:24 }}>Check the status anytime from your dashboard → "Review filed entries", or from "My logs" if you are a worker.</div>
          <PrimaryButton onClick={()=>setScreen("landing")}>Back to home</PrimaryButton>
        </div>
      </Shell>
    );
  }

  // ── Review queue (supervisor/admin) ──────────────────────────────
  if (screen === "reviewQueue" && isAdminOrSup && session.role!=="beta") {
    const scoped = filedEntries;
    const list = scoped.filter((e)=>e.status===filedTab);
    const handleApprove=(entry)=>{
      const approved={...entry,status:"approved",approvedBy:session.name};
      updateFiledEntry(entry.id, approved);
      const resolvedCrewByVehicle={};
      (entry.vehicles||[]).forEach((v)=>{resolvedCrewByVehicle[v]=entry.crew||[];});
      const newJob={
        id:`job-${entry.id}`, team:entry.team, checker:entry.checker, jobSite:entry.jobSite,
        checkInTime:entry.checkInTime, checkOutTime:entry.checkOutTime, hours:entry.hours,
        vehicles:entry.vehicles, crew:entry.crew, crewByVehicle:resolvedCrewByVehicle,
        serviceLines:entry.serviceLines, jobsheet:entry.jobsheet, pubDisposal:entry.pubDisposal,
        remarks:entry.remarks, wasFiledEntry:true, filedReason:entry.reason, filedBy:entry.filedBy||entry.checker, approvedBy:session.name,
      };
      addJob(newJob);
    };
    const handleReject=(entry)=>{setReviewTarget(entry);setRejectionNote("");setScreen("reviewReject");};
    const handleUndo=(entry)=>{
      if (entry.status==="approved") deleteJob(`job-${entry.id}`);
      updateFiledEntry(entry.id, {status:"pending",approvedBy:null,rejectionNote:null});
    };
    return (
      <Shell>
        <Header title="Review filed entries" onBack={()=>goBack("landing")} accent="#C2570C" />
        <FiledTabs entries={scoped} active={filedTab} onChange={setFiledTab} />
        {list.length===0 && <div style={{ textAlign:"center", color:SLATE_LIGHT, fontSize:13, padding:"30px 0" }}>Nothing here yet</div>}
        {list.map((e)=><FiledStatusCard key={e.id} entry={e} isReviewer onApprove={handleApprove} onReject={handleReject} onUndo={handleUndo} />)}
      </Shell>
    );
  }

  if (screen === "reviewReject" && reviewTarget) {
    return (
      <Shell>
        <Header title="Reject filed entry" onBack={()=>goBack("reviewQueue")} accent={RED} />
        <div style={{ border:`1px solid ${BORDER}`, borderRadius:13, padding:14, marginBottom:16, background:"white" }}>
          <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:2 }}>{reviewTarget.jobSite}</div>
          <div style={{ fontSize:12, color:SLATE }}>Filed by {reviewTarget.checker} · {teamLabel(reviewTarget.team)}</div>
        </div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Reason for rejection (required — the worker will see this)</div>
        <input autoFocus placeholder="e.g. Times don't match the jobsheet, please refile with correct times" value={rejectionNote} onChange={(e)=>setRejectionNote(e.target.value)} style={{ ...inputStyle, marginBottom:18 }} />
        <PrimaryButton accent={RED} disabled={!rejectionNote.trim()} onClick={()=>{
          updateFiledEntry(reviewTarget.id, {status:"rejected", rejectionNote:rejectionNote.trim()});
          setReviewTarget(null); setRejectionNote(""); setScreen("reviewQueue");
        }}>Confirm rejection</PrimaryButton>
      </Shell>
    );
  }

  // ── My filed entries (worker) ─────────────────────────────────────
  if (screen === "myFiledEntries") {
    const mine = filedEntries.filter((e)=>(e.filedBy===session.name||e.checker===session.name||(e.crew||[]).includes(session.name)));
    const list = mine.filter((e)=>e.status===filedTab);
    const handleWithdraw=(entry)=>deleteFiledEntry(entry.id);
    const handleAmend=(entry)=>{
      const restored = entry.originalDraft ? {...entry.originalDraft,reason:""} : {...emptyFiledDraft(),team:entry.team,jobSite:entry.jobSite};
      setFiledDraft(restored);
      deleteFiledEntry(entry.id); setScreen("filedTimes");
    };
    return (
      <Shell>
        <Header title="My filed entries" onBack={()=>goBack("myJobLog")} accent="#C2570C" />
        <FiledTabs entries={mine} active={filedTab} onChange={setFiledTab} />
        {list.length===0 && <div style={{ textAlign:"center", color:SLATE_LIGHT, fontSize:13, padding:"30px 0" }}>Nothing here yet</div>}
        {list.map((e)=><FiledStatusCard key={e.id} entry={e} isReviewer={false} onWithdraw={handleWithdraw} onAmend={handleAmend} />)}
      </Shell>
    );
  }

  // ── Fuel fill-up ────────────────────────────────────────────────
  if (screen === "fuelTeam") {
    return (
      <Shell>
        <Header title="Fuel fill-up" onBack={()=>goBack("landing")} accent={AMBER} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>Which team's vehicle?</div>
        {["tanker","jetting","watertank"].map((t)=>{
          const allowed=isAdminOrSup||t===session.team;
          if(!allowed) return <div key={t} style={{ ...tileStyle(), cursor:"not-allowed", opacity:0.55, background:CANVAS }}><span style={{ ...tileIconStyle, background:"white" }}><TeamIcon team={t} color={SLATE_LIGHT} /></span><span><span style={{ ...tileTitleStyle, color:SLATE }}>{teamLabel(t)} team</span></span></div>;
          return <button key={t} onClick={()=>{setFuelDraft({...emptyFuelDraft(),team:t,person:session.name});setScreen("fuelVehicle");}} style={tileStyle()}><span style={{ ...tileIconStyle, background:CANVAS }}><TeamIcon team={t} color={teamAccent(t)} /></span><span style={tileTitleStyle}>{teamLabel(t)} team</span></button>;
        })}
      </Shell>
    );
  }

  if (screen === "fuelVehicle" && fuelDraft.team) {
    const vehicles = teamVehicles(fuelDraft.team).filter((v)=>v!=="Others");
    return (
      <Shell>
        <Header title="Select vehicle" onBack={()=>goBack("fuelTeam")} accent={AMBER} />
        {vehicles.map((v)=>(
          <button key={v} onClick={()=>{setFuelDraft({...fuelDraft,vehicle:v});setScreen("fuelDetails");}} style={{ ...tileStyle(), padding:16 }}>
            <span style={{ width:40, height:40, borderRadius:11, background:AMBER_LIGHT, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Fuel size={18} color={AMBER} /></span>
            <span style={{ fontSize:14, fontWeight:700, color:INK }}>{v}</span>
          </button>
        ))}
      </Shell>
    );
  }

  if (screen === "fuelDetails" && fuelDraft.vehicle) {
    const isJetting = isJettingVehicle(fuelDraft.vehicle);
    const costPerLitre = fuelDraft.amount && fuelDraft.price && parseFloat(fuelDraft.amount) > 0
      ? (parseFloat(fuelDraft.price)/parseFloat(fuelDraft.amount)).toFixed(3) : null;
    const effectiveCompany = fuelDraft.company === "Others" ? (fuelDraft.companyCustom||"").trim() : fuelDraft.company;
    const valid = effectiveCompany && fuelDraft.amount && fuelDraft.price && fuelDraft.mileage;
    return (
      <Shell>
        <Header title="Fill-up details" onBack={()=>goBack("fuelVehicle")} accent={AMBER} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Fuel station</div>
        <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom: fuelDraft.company === "Others" ? 8 : 14 }}>
          {FUEL_COMPANIES.map((c)=>{
            const isSel=fuelDraft.company===c;
            return <button key={c} onClick={()=>setFuelDraft({...fuelDraft,company:c,companyCustom:""})} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:12, border:isSel?`1.5px solid ${AMBER}`:`1px solid ${BORDER}`, background:isSel?AMBER_LIGHT:"white", textAlign:"left", cursor:"pointer", fontSize:14, color:INK }}><span style={{ width:18, height:18, borderRadius:"50%", border:`1.5px solid ${isSel?AMBER:"#D1D5DB"}`, background:isSel?AMBER:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{isSel&&<Check size={11} color="white" strokeWidth={3} />}</span>{c}</button>;
          })}
        </div>
        {fuelDraft.company === "Others" && (
          <input autoFocus placeholder="Station name" value={fuelDraft.companyCustom||""} onChange={(e)=>setFuelDraft({...fuelDraft,companyCustom:e.target.value})} style={{ ...inputStyle, marginBottom:14 }} />
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Litres filled</div><input type="number" step="0.1" value={fuelDraft.amount} onChange={(e)=>setFuelDraft({...fuelDraft,amount:e.target.value})} placeholder="e.g. 55.0" style={{ ...inputStyle, marginBottom:0 }} /></div>
          <div><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Total price (S$)</div><input type="number" step="0.01" value={fuelDraft.price} onChange={(e)=>setFuelDraft({...fuelDraft,price:e.target.value})} placeholder="e.g. 112.50" style={{ ...inputStyle, marginBottom:0 }} /></div>
        </div>
        {costPerLitre && (
          <div style={{ background:GREEN_LIGHT, borderRadius:10, padding:"9px 13px", marginTop:6, marginBottom:10, fontSize:12, color:GREEN_DARK, fontWeight:600 }}>
            S${costPerLitre} per litre
          </div>
        )}
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, marginTop:8, fontWeight:600 }}>Odometer (km)</div>
        <input type="number" value={fuelDraft.mileage} onChange={(e)=>setFuelDraft({...fuelDraft,mileage:e.target.value})} placeholder="e.g. 84210" style={inputStyle} />
        {isJetting && (
          <>
            <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Water tank odometer (km)</div>
            <input type="number" value={fuelDraft.mileageAux} onChange={(e)=>setFuelDraft({...fuelDraft,mileageAux:e.target.value})} placeholder="Water pump meter" style={inputStyle} />
            <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Which tank?</div>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              {["main","aux","both"].map((t)=>{
                const labels={main:"Main tank",aux:"Aux tank",both:"Both tanks"};
                const isSel=fuelDraft.tank===t;
                return <button key={t} onClick={()=>setFuelDraft({...fuelDraft,tank:t})} style={{ flex:1, padding:"10px 8px", borderRadius:10, border:isSel?`1.5px solid ${AMBER}`:`1px solid ${BORDER}`, background:isSel?AMBER_LIGHT:"white", color:isSel?AMBER_DARK:SLATE, fontSize:12, fontWeight:600, cursor:"pointer" }}>{labels[t]}</button>;
              })}
            </div>
          </>
        )}
        <PrimaryButton accent={AMBER} disabled={!valid} onClick={()=>{
          const record={
            id:`fuel-${Date.now()}`, team:fuelDraft.team, person:fuelDraft.person||session.name,
            vehicle:fuelDraft.vehicle, company:effectiveCompany, amount:fuelDraft.amount,
            price:fuelDraft.price, mileage:fuelDraft.mileage, mileageAux:fuelDraft.mileageAux,
            tank:fuelDraft.tank, date:Date.now(),
          };
          if(isBeta) setBetaFuelHistory((p)=>[record,...p]);
          else addFuel(record);
          setFuelDraft(emptyFuelDraft());
          setScreen("fuelDone");
        }}>
          <Fuel size={16} /> Log fill-up
        </PrimaryButton>
      </Shell>
    );
  }

  if (screen === "fuelDone") {
    const recent = isBeta ? [...betaFuelHistory].sort((a,b)=>b.date-a.date)[0] : myLastFillUp;
    if (!recent) { setScreen("landing"); return null; }
    const cpl = recent.amount && recent.price && parseFloat(recent.amount) > 0
      ? (parseFloat(recent.price)/parseFloat(recent.amount)).toFixed(3) : null;
    const delta = mileageDeltaFor(recent, isBeta ? betaFuelHistory : fuelHistory);
    return (
      <Shell>
        <div style={{ textAlign:"center", padding:"32px 0 20px" }}>
          <CheckCircle2 size={44} color={GREEN} />
          <div style={{ fontSize:16, fontWeight:700, margin:"14px 0 4px" }}>Fill-up logged</div>
          <div style={{ fontSize:13, color:SLATE, marginBottom:20 }}>{recent.vehicle}</div>
        </div>
        <div style={{ border:`1px solid ${BORDER}`, borderRadius:16, background:"white", overflow:"hidden", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:`1px solid ${BORDER}`, background:CANVAS }}>
            <div style={{ width:36, height:36, borderRadius:10, background:AMBER_LIGHT, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Fuel size={17} color={AMBER} />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:INK }}>{recent.company}</div>
              <div style={{ fontSize:11, color:SLATE_LIGHT }}>
                {new Date(recent.date).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"numeric"})}
                {" · "}{new Date(recent.date).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
              </div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", padding:"16px", paddingBottom: delta!==null ? 8 : 16 }}>
            <div style={{ borderRight:`1px solid ${BORDER}`, paddingRight:12 }}>
              <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, letterSpacing:0.3, marginBottom:4, textTransform:"uppercase" }}>Litres</div>
              <div style={{ fontSize:20, fontWeight:800, color:INK }}>{parseFloat(recent.amount).toFixed(1)}</div>
              <div style={{ fontSize:10, color:SLATE_LIGHT }}>L</div>
            </div>
            <div style={{ borderRight:`1px solid ${BORDER}`, paddingLeft:12, paddingRight:12 }}>
              <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, letterSpacing:0.3, marginBottom:4, textTransform:"uppercase" }}>Total</div>
              <div style={{ fontSize:20, fontWeight:800, color:INK }}>S${parseFloat(recent.price).toFixed(2)}</div>
              {cpl && <div style={{ fontSize:10, color:GREEN_DARK, fontWeight:700 }}>S${cpl}/L</div>}
            </div>
            <div style={{ paddingLeft:12 }}>
              <div style={{ fontSize:10, color:SLATE_LIGHT, fontWeight:700, letterSpacing:0.3, marginBottom:4, textTransform:"uppercase" }}>Odometer</div>
              <div style={{ fontSize:20, fontWeight:800, color:INK }}>{recent.mileage || "—"}</div>
              <div style={{ fontSize:10, color:SLATE_LIGHT }}>km</div>
            </div>
          </div>
          {delta !== null && (
            <div style={{ margin:"0 16px 16px", background:BLUE_LIGHT, borderRadius:9, padding:"7px 11px", fontSize:11.5, fontWeight:600, color:BLUE_DARK, display:"flex", alignItems:"center", gap:5 }}>
              <TrendingUp size={12} /> {delta.toFixed(0)} km since previous fill-up
            </div>
          )}
        </div>
        <PrimaryButton accent={AMBER} onClick={()=>setScreen("landing")}>Back to home</PrimaryButton>
      </Shell>
    );
  }

  // ── Logs: my personal log ────────────────────────────────────────
  if (screen === "myJobLog") {
    const myJobs = [...currentJobHistory.filter((j)=>jobCreditedPeople(j).includes(session.name))].sort((a,b)=>b.checkInTime-a.checkInTime);
    const totals = personTotals(currentJobHistory, session.name);
    return (
      <Shell>
        <Header title="My logs" onBack={()=>goBack("landing")} />
        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <div style={{ flex:1, background:"white", border:`1px solid ${BORDER}`, borderRadius:13, padding:"13px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}><Clock size={12} color={BLUE} /><span style={{ fontSize:10.5, color:SLATE, fontWeight:700, letterSpacing:0.3 }}>TOTAL HOURS</span></div>
            <div style={{ fontSize:19, fontWeight:800, color:INK }}>{totals.hours.toFixed(1)}</div>
          </div>
          <div style={{ flex:1, background:"white", border:`1px solid ${BORDER}`, borderRadius:13, padding:"13px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}><TrendingUp size={12} color={AMBER} /><span style={{ fontSize:10.5, color:SLATE, fontWeight:700, letterSpacing:0.3 }}>TENTATIVE OT</span></div>
            <div style={{ fontSize:19, fontWeight:800, color:INK }}>{totals.ot.toFixed(1)}</div>
          </div>
        </div>
        <div style={{ fontSize:10.5, color:SLATE_LIGHT, fontStyle:"italic", marginBottom:14 }}>OT hours are tentative and pending management review.</div>
        {session.role === "worker" && (
          <button onClick={()=>{setFiledTab("pending");setScreen("myFiledEntries");}} style={tileStyle()}>
            <span style={{ ...tileIconStyle, background:"#FEF0E6" }}><FileClock size={20} color="#C2570C" /></span>
            <span style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span><span style={tileTitleStyle}>My filed entries</span><span style={tileSubStyle}>Track your missed check-in filings</span></span>
              {filedEntries.filter((e)=>(e.filedBy===session.name||e.checker===session.name||(e.crew||[]).includes(session.name))&&e.status==="pending").length>0 && <span style={{ fontSize:12, fontWeight:800, color:"white", background:"#C2570C", borderRadius:20, padding:"3px 9px", flexShrink:0 }}>{filedEntries.filter((e)=>(e.filedBy===session.name||e.checker===session.name||(e.crew||[]).includes(session.name))&&e.status==="pending").length}</span>}
            </span>
          </button>
        )}
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, margin:"12px 0 10px", textTransform:"uppercase", letterSpacing:0.5 }}>Job history</div>
        {myJobs.length===0 && <div style={{ textAlign:"center", color:SLATE_LIGHT, fontSize:13, padding:"24px 0" }}>No job history yet</div>}
        {myJobs.map((j,i)=>{
          const dayType=getDayType(j.checkInTime); const ot=calcOT(j.checkInTime,j.checkOutTime); const premium=isPremiumDay(dayType);
          const isHelping = j.team!==(userDirectory.find((u)=>u.name===session.name)?.team);
          return (
            <div key={j.id||i} style={{ border:j.wasFiledEntry?`1.5px solid #C2570C55`:`1px solid ${BORDER}`, borderRadius:13, padding:15, marginBottom:10, background:j.wasFiledEntry?"#FFFBF7":"white" }}>
              {j.wasFiledEntry && <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10, padding:"6px 10px", background:"#FEF0E6", borderRadius:8, color:"#C2570C", fontSize:11, fontWeight:700 }}><FileClock size={13} /> Filed entry — approved by {j.approvedBy||"supervisor"}</div>}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:7, background:CANVAS, color:"#374151", display:"inline-flex", alignItems:"center", gap:5 }}><TeamIcon team={j.team} size={12} color={teamAccent(j.team)} /> {teamLabel(j.team)}</span>
                {isHelping && <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 8px", borderRadius:7, background:PURPLE_LIGHT, color:PURPLE }}>Supporting another team</span>}
                <span style={{ fontSize:11, color:premium?RED:SLATE_LIGHT, fontWeight:premium?700:400, marginLeft:"auto" }}>{dayType}</span>
              </div>
              <div style={{ fontSize:14.5, fontWeight:700, color:INK, marginBottom:2 }}>{j.jobSite}</div>
              <div style={{ fontSize:12, color:SLATE, marginBottom:10 }}>
                {new Date(j.checkInTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short"})}
                {" · "}{new Date(j.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
                {" – "}{new Date(j.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>{j.hours} hrs</span>
                {ot>0 && <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:6, background:premium?RED_LIGHT:GREEN_LIGHT, color:premium?RED:GREEN_DARK }}>{ot.toFixed(1)} OT{premium?" (2×)":""}</span>}
              </div>
              <JobDetailDropdown job={j} />
            </div>
          );
        })}
      </Shell>
    );
  }

  // ── Logs home (team lead) ─────────────────────────────────────────
  if (screen === "logsHome") {
    return (
      <Shell>
        <Header title="Team logs" onBack={()=>goBack("landing")} />
        <button onClick={()=>{setLogTeamFilter(null);setScreen("jobLogTeam");}} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:BLUE_LIGHT }}><ClipboardList size={20} color={BLUE} /></span>
          <span><span style={tileTitleStyle}>Job history</span><span style={tileSubStyle}>Browse by team</span></span>
        </button>
        <button onClick={()=>{setLogTeamFilter(null);setScreen("fuelLogTeam");}} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:AMBER_LIGHT }}><Fuel size={20} color={AMBER} /></span>
          <span><span style={tileTitleStyle}>Fuel fill-up history</span><span style={tileSubStyle}>By vehicle, across all drivers</span></span>
        </button>
        <button onClick={()=>{setLogPersonName(null);setLogTeamFilter(null);setScreen("personnelLog");}} style={tileStyle()}>
          <span style={{ ...tileIconStyle, background:PURPLE_LIGHT }}><Users size={20} color={PURPLE} /></span>
          <span><span style={tileTitleStyle}>Personnel log</span><span style={tileSubStyle}>View any worker's individual movements</span></span>
        </button>
      </Shell>
    );
  }

  if (screen === "jobLogTeam") {
    return (
      <Shell>
        <Header title="Job history" onBack={()=>goBack("logsHome")} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>Which team's jobs?</div>
        {["tanker","jetting","watertank"].map((t)=>{
          const allowed=isAdminOrSup||t===session.team;
          if(!allowed) return <div key={t} style={{ ...tileStyle(), cursor:"not-allowed", opacity:0.55, background:CANVAS }}><span style={{ ...tileIconStyle, background:"white" }}><TeamIcon team={t} color={SLATE_LIGHT} /></span><span><span style={{ ...tileTitleStyle, color:SLATE }}>{teamLabel(t)} team</span></span></div>;
          return <button key={t} onClick={()=>{setLogTeamFilter(t);setScreen("jobLogView");}} style={tileStyle()}><span style={{ ...tileIconStyle, background:CANVAS }}><TeamIcon team={t} color={teamAccent(t)} /></span><span style={tileTitleStyle}>{teamLabel(t)} team</span></button>;
        })}
      </Shell>
    );
  }

  if (screen === "jobLogView" && logTeamFilter) {
    const accent=teamAccent(logTeamFilter);
    const sorters={
      date_desc:(a,b)=>b.checkInTime-a.checkInTime, date_asc:(a,b)=>a.checkInTime-b.checkInTime,
      name_asc:(a,b)=>a.checker.localeCompare(b.checker), site_asc:(a,b)=>a.jobSite.localeCompare(b.jobSite),
    };
    let teamJobs=[...currentJobHistory.filter((j)=>j.team===logTeamFilter)].sort(sorters[jobSort]||sorters.date_desc);
    // Search filter
    if (jobSearch.trim()) {
      const q=jobSearch.toLowerCase();
      teamJobs=teamJobs.filter((j)=>
        j.jobSite?.toLowerCase().includes(q)||
        j.checker?.toLowerCase().includes(q)||
        j.jobsheet?.toLowerCase().includes(q)||
        (j.crew||[]).some((c)=>c.toLowerCase().includes(q))
      );
    }
    const { hours: totHrs, ot: totOT } = teamTotals(teamJobs);
    const sortOptions=[{key:"date_desc",label:"Newest"},{key:"date_asc",label:"Oldest"},{key:"name_asc",label:"Checker A–Z"},{key:"site_asc",label:"Site A–Z"}];
    return (
      <Shell>
        <Header title={`${teamLabel(logTeamFilter)} jobs`} onBack={()=>goBack("jobLogTeam")} accent={accent} />
        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <div style={{ flex:1, background:"white", border:`1px solid ${BORDER}`, borderRadius:13, padding:"12px 14px" }}>
            <div style={{ fontSize:10.5, color:SLATE, fontWeight:700, letterSpacing:0.3, marginBottom:4 }}>TOTAL HRS</div>
            <div style={{ fontSize:19, fontWeight:800, color:INK }}>{totHrs.toFixed(1)}</div>
          </div>
          <div style={{ flex:1, background:isAdminOrSup?"white":CANVAS, border:`1px solid ${BORDER}`, borderRadius:13, padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>{!isAdminOrSup&&<Lock size={10} color={SLATE_LIGHT} />}<div style={{ fontSize:10.5, color:SLATE, fontWeight:700, letterSpacing:0.3 }}>TOTAL OT</div></div>
            {isAdminOrSup ? <div style={{ fontSize:19, fontWeight:800, color:INK }}>{totOT.toFixed(1)}</div> : <div style={{ fontSize:12.5, fontWeight:700, color:SLATE_LIGHT, marginTop:2 }}>Not authorised</div>}
          </div>
          <div style={{ flex:1, background:"white", border:`1px solid ${BORDER}`, borderRadius:13, padding:"12px 14px" }}>
            <div style={{ fontSize:10.5, color:SLATE, fontWeight:700, letterSpacing:0.3, marginBottom:4 }}>JOBS</div>
            <div style={{ fontSize:19, fontWeight:800, color:INK }}>{teamJobs.length}</div>
          </div>
        </div>
        {/* Search bar */}
        <div style={{ position:"relative", marginBottom:14 }}>
          <Search size={15} color={SLATE_LIGHT} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)" }} />
          <input value={jobSearch} onChange={(e)=>setJobSearch(e.target.value)} placeholder="Search by site, checker, jobsheet, crew…" style={{ ...inputStyle, paddingLeft:36, marginBottom:0 }} />
        </div>
        <div style={{ marginBottom:14 }}><ChipGroup options={sortOptions.map((o)=>o.label)} value={sortOptions.find((o)=>o.key===jobSort)?.label} onPick={(label)=>setJobSort(sortOptions.find((o)=>o.label===label).key)} accent={accent} /></div>
        {teamJobs.length===0 && <div style={{ textAlign:"center", color:SLATE_LIGHT, fontSize:13, padding:"24px 0" }}>No results</div>}
        {teamJobs.map((j,i)=>{
          const dayType=getDayType(j.checkInTime); const ot=calcOT(j.checkInTime,j.checkOutTime); const premium=isPremiumDay(dayType);
          const allPeople=[...new Set([j.checker,...(j.crew||[])])];
          const isLongEntry=parseFloat(j.hours||0)>12;
          return (
            <div key={j.id||i} style={{ border:isLongEntry?`1.5px solid ${AMBER}`:j.wasFiledEntry?`1.5px solid #C2570C55`:`1px solid ${BORDER}`, borderRadius:13, padding:15, marginBottom:10, background:isLongEntry?AMBER_LIGHT:j.wasFiledEntry?"#FFFBF7":"white" }}>
              {isLongEntry && <div style={{ fontSize:11, color:AMBER_DARK, fontWeight:700, marginBottom:8 }}>⚠️ Long job ({j.hours} hrs)</div>}
              {j.wasFiledEntry && <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10, padding:"6px 10px", background:"#FEF0E6", borderRadius:8, color:"#C2570C", fontSize:11, fontWeight:700 }}><FileClock size={13} /> Filed entry — approved by {j.approvedBy||"supervisor"}</div>}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:7, background:BLUE_LIGHT, color:BLUE }}>Checked in by {j.checker}</span>
                <span style={{ fontSize:11, color:premium?RED:SLATE_LIGHT, fontWeight:premium?700:400 }}>{dayType}</span>
              </div>
              <div style={{ fontSize:14.5, fontWeight:700, color:j.jobSite?INK:SLATE_LIGHT, marginBottom:2, fontStyle:j.jobSite?"normal":"italic" }}>{j.jobSite||"No site recorded"}</div>
              <div style={{ fontSize:12, color:SLATE, marginBottom:10 }}>
                {new Date(j.checkInTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short"})}
                {" · "}{new Date(j.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
                {" – "}{new Date(j.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
                {" · "}<strong>{j.hours} hrs</strong>
                {ot>0 && isAdminOrSup && <> · <span style={{ color:premium?RED:GREEN_DARK, fontWeight:700 }}>{ot.toFixed(1)} OT{premium?" (2×)":""}</span></>}
              </div>
              {j.vehicles?.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>{j.vehicles.map((v)=><span key={v} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}><Truck size={11} color="#6B7280" />{v}</span>)}</div>}
              <div style={{ fontSize:10.5, fontWeight:700, color:SLATE, marginBottom:6, textTransform:"uppercase", letterSpacing:0.3 }}>Personnel</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {allPeople.map((person)=>{
                  const otVisible=canSeeOT(session,person);
                  return (
                    <span key={person} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11.5, fontWeight:600, padding:"4px 9px", borderRadius:7, background:CANVAS, color:INK }}>
                      {person}
                      {otVisible ? (ot>0 && <span style={{ color:premium?RED:GREEN_DARK, fontWeight:700 }}>· {ot.toFixed(1)} OT</span>) : <Lock size={9} color={SLATE_LIGHT} />}
                    </span>
                  );
                })}
              </div>
              <JobDetailDropdown job={j} />
              {isAdminOrSup && session.role!=="beta" && (
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <button onClick={()=>{setEditTarget(j);setEditDraft({jobSite:j.jobSite,manualCheckIn:new Date(j.checkInTime-new Date(j.checkInTime).getTimezoneOffset()*60000).toISOString().slice(0,16),manualCheckOut:new Date(j.checkOutTime-new Date(j.checkOutTime).getTimezoneOffset()*60000).toISOString().slice(0,16),vehicles:[...(j.vehicles||[])],crew:[...(j.crew||[])],jobsheet:j.jobsheet||"",pubDisposal:j.pubDisposal||"",remarks:j.remarks||""});setScreen("editEntry");}} style={{ flex:1, padding:10, borderRadius:9, border:`1px solid ${BLUE}`, background:"white", color:BLUE, fontSize:12.5, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Pencil size={13} /> Edit</button>
                  <button onClick={()=>{setEntryDeleteTarget(j);setEntryDeleteCode("");setEntryDeleteError(null);setScreen("entryDeleteConfirm");}} style={{ flex:1, padding:10, borderRadius:9, border:`1px solid ${RED}`, background:"white", color:RED, fontSize:12.5, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Trash2 size={13} /> Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </Shell>
    );
  }

  // ── Personnel log ─────────────────────────────────────────────────
  if (screen === "personnelLog") {
    const isWorker = session.role === "worker";
    const canPickAnyone = isAdminOrSup;
    const pickableNames = canPickAnyone
      ? userDirectory.filter((u)=>u.role==="worker"||u.role==="supervisor").map((u)=>u.name).sort((a,b)=>a.localeCompare(b))
      : userDirectory.filter((u)=>u.role==="worker"&&u.team===session.team).map((u)=>u.name).sort((a,b)=>a.localeCompare(b));
    const involvedTarget = logPersonName || session.name;
    let myJobs = [...currentJobHistory.filter((j)=>jobCreditedPeople(j).includes(involvedTarget))].sort((a,b)=>b.checkInTime-a.checkInTime);
    const totals = personTotals(currentJobHistory, involvedTarget);
    const otVisible = canSeeOT(session,involvedTarget);
    return (
      <Shell>
        <Header title="Personnel log" onBack={()=>goBack(isWorker?"landing":"logsHome")} accent={PURPLE} />

        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Individual logs</div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>{canPickAnyone?"Select a person":"Select a teammate"}</div>
        <PickList label="Select one" options={pickableNames} selected={logPersonName} multi={false} accent={PURPLE} onToggle={(val)=>setLogPersonName(val)} />
        {logPersonName && (
          <>
            <div style={{ display:"flex", gap:10, marginBottom:14 }}>
              <div style={{ flex:1, background:"white", border:`1px solid ${BORDER}`, borderRadius:13, padding:"13px 14px" }}>
                <div style={{ fontSize:10.5, color:SLATE, fontWeight:700, letterSpacing:0.3, marginBottom:4 }}>TOTAL HOURS</div>
                <div style={{ fontSize:19, fontWeight:800, color:INK }}>{totals.hours.toFixed(1)}</div>
              </div>
              <div style={{ flex:1, background:otVisible?"white":CANVAS, border:`1px solid ${BORDER}`, borderRadius:13, padding:"13px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>{!otVisible&&<Lock size={11} color={SLATE_LIGHT} />}<div style={{ fontSize:10.5, color:SLATE, fontWeight:700, letterSpacing:0.3 }}>TENTATIVE OT</div></div>
                {otVisible?<div style={{ fontSize:19, fontWeight:800, color:INK }}>{totals.ot.toFixed(1)}</div>:<div style={{ fontSize:12.5, fontWeight:700, color:SLATE_LIGHT, marginTop:2 }}>Not authorised</div>}
              </div>
            </div>
            {myJobs.length===0 && <div style={{ textAlign:"center", color:SLATE_LIGHT, fontSize:13, padding:"24px 0" }}>No job history yet</div>}
            {myJobs.map((j,i)=>{
              const dayType=getDayType(j.checkInTime); const ot=calcOT(j.checkInTime,j.checkOutTime); const premium=isPremiumDay(dayType);
              return (
                <div key={j.id||i} style={{ border:`1px solid ${BORDER}`, borderRadius:13, padding:15, marginBottom:10, background:"white" }}>
                  <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:7, background:CANVAS, color:"#374151", display:"inline-flex", alignItems:"center", gap:5 }}><TeamIcon team={j.team} size={12} color={teamAccent(j.team)} /> {teamLabel(j.team)}</span>
                    <span style={{ fontSize:11, color:premium?RED:SLATE_LIGHT, fontWeight:premium?700:400, marginLeft:"auto" }}>{dayType}</span>
                  </div>
                  <div style={{ fontSize:14.5, fontWeight:700, color:INK, marginBottom:2 }}>{j.jobSite}</div>
                  <div style={{ fontSize:12, color:SLATE, marginBottom:10 }}>
                    {new Date(j.checkInTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short"})}
                    {" · "}{new Date(j.checkInTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
                    {" – "}{new Date(j.checkOutTime).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}
                    {j.checker!==involvedTarget&&` · checked in by ${j.checker}`}
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>{j.hours} hrs</span>
                    {otVisible?(ot>0&&<span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:6, background:premium?RED_LIGHT:GREEN_LIGHT, color:premium?RED:GREEN_DARK }}>{ot.toFixed(1)} OT{premium?" (2×)":""}</span>):<span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:SLATE_LIGHT, display:"flex", alignItems:"center", gap:4 }}><Lock size={10} /> OT hidden</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Shell>
    );
  }

  // ── Fuel log views ───────────────────────────────────────────────
  if (screen === "fuelLogTeam") {
    return (
      <Shell>
        <Header title="Fuel fill-up history" onBack={()=>goBack("logsHome")} accent={AMBER} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>Which team's vehicles?</div>
        {["tanker","jetting","watertank"].map((t)=>{
          const allowed=isAdminOrSup||t===session.team;
          if(!allowed) return (
            <div key={t} style={{ ...tileStyle(), cursor:"not-allowed", opacity:0.55, background:CANVAS }}>
              <span style={{ ...tileIconStyle, background:"white" }}><TeamIcon team={t} color={SLATE_LIGHT} /></span>
              <span><span style={{ ...tileTitleStyle, color:SLATE }}>{teamLabel(t)} team</span><span style={{ ...tileSubStyle, color:SLATE_LIGHT, fontWeight:600 }}>Not authorised</span></span>
            </div>
          );
          return (
            <button key={t} onClick={()=>{setLogTeamFilter(t);setLogVehicleName(null);setScreen("fuelLogVehicle");}} style={tileStyle()}>
              <span style={{ ...tileIconStyle, background:CANVAS }}><TeamIcon team={t} color={teamAccent(t)} /></span>
              <span style={tileTitleStyle}>{teamLabel(t)} team</span>
            </button>
          );
        })}
      </Shell>
    );
  }

  if (screen === "fuelLogVehicle" && logTeamFilter) {
    const vehiclesInTeam = teamVehicles(logTeamFilter).filter((v)=>v!=="Others");
    return (
      <Shell>
        <Header title={`${teamLabel(logTeamFilter)} vehicles`} onBack={()=>goBack("fuelLogTeam")} accent={AMBER} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>Select a vehicle to see its fill-up history</div>
        {vehiclesInTeam.map((v)=>(
          <button key={v} onClick={()=>{setLogVehicleName(v);setScreen("fuelLogView");}} style={{ ...tileStyle(), padding:16 }}>
            <span style={{ width:40, height:40, borderRadius:11, background:AMBER_LIGHT, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Fuel size={18} color={AMBER} /></span>
            <span style={{ fontSize:14, fontWeight:700, color:INK }}>{v}</span>
          </button>
        ))}
      </Shell>
    );
  }

  if (screen === "fuelLogView" && logVehicleName) {
    const allForVehicle = currentFuelHistory.filter((f)=>f.vehicle===logVehicleName);
    const chronological = [...allForVehicle].sort((a,b)=>a.date-b.date);
    const mileageDeltaById = {};
    for (let i=0;i<chronological.length;i++) {
      const cur=chronological[i]; const prev=chronological[i-1];
      const curM=parseFloat(cur.mileage); const prevM=prev?parseFloat(prev.mileage):null;
      if (i===0||prevM===null||isNaN(curM)||isNaN(prevM)) mileageDeltaById[cur.id]=null;
      else { const delta=curM-prevM; mileageDeltaById[cur.id]=delta>=0?delta:null; }
    }
    const sorters={ date_desc:(a,b)=>b.date-a.date, date_asc:(a,b)=>a.date-b.date, name_asc:(a,b)=>a.person.localeCompare(b.person), company_asc:(a,b)=>a.company.localeCompare(b.company) };
    const myFillUps=[...allForVehicle].sort(sorters[fuelSort]||sorters.date_desc);
    const sortOptions=[{key:"date_desc",label:"Newest first"},{key:"date_asc",label:"Oldest first"},{key:"name_asc",label:"Driver A–Z"},{key:"company_asc",label:"Station A–Z"}];
    const totals=myFillUps.reduce((acc,f)=>{ acc.litres+=parseFloat(f.amount||0); acc.spend+=parseFloat(f.price||0); return acc; },{litres:0,spend:0});
    return (
      <Shell>
        <Header title={logVehicleName} onBack={()=>goBack("fuelLogVehicle")} accent={AMBER} />
        <div style={{ display:"flex", gap:10, marginBottom:18 }}>
          <div style={{ flex:1, background:AMBER_LIGHT, borderRadius:13, padding:"12px 14px" }}><div style={{ fontSize:11, color:AMBER_DARK, fontWeight:600, marginBottom:4 }}>Total litres</div><div style={{ fontSize:19, fontWeight:800, color:AMBER_DARK }}>{totals.litres.toFixed(1)}</div></div>
          <div style={{ flex:1, background:"#F1EFE8", borderRadius:13, padding:"12px 14px" }}><div style={{ fontSize:11, color:"#5F5E5A", fontWeight:600, marginBottom:4 }}>Total spend</div><div style={{ fontSize:19, fontWeight:800, color:"#2C2C2A" }}>S${totals.spend.toFixed(0)}</div></div>
          <div style={{ flex:1, background:BLUE_LIGHT, borderRadius:13, padding:"12px 14px" }}><div style={{ fontSize:11, color:BLUE_DARK, fontWeight:600, marginBottom:4 }}>Fill-ups</div><div style={{ fontSize:19, fontWeight:800, color:BLUE_DARK }}>{myFillUps.length}</div></div>
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Sort by</div>
        <div style={{ marginBottom:18 }}><ChipGroup options={sortOptions.map((o)=>o.label)} value={sortOptions.find((o)=>o.key===fuelSort)?.label} onPick={(label)=>setFuelSort(sortOptions.find((o)=>o.label===label).key)} accent={AMBER} /></div>
        {myFillUps.length===0 && <div style={{ fontSize:13, color:SLATE_LIGHT, textAlign:"center", padding:"24px 0" }}>No fill-up history yet</div>}
        {myFillUps.map((f,i)=>{
          const delta=mileageDeltaById[f.id];
          const cpl = f.amount&&f.price&&parseFloat(f.amount)>0 ? (parseFloat(f.price)/parseFloat(f.amount)).toFixed(3) : null;
          return (
            <div key={f.id||i} style={{ border:`1px solid ${BORDER}`, borderRadius:13, padding:14, marginBottom:10, background:"white" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ display:"flex", gap:6 }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:7, background:AMBER_LIGHT, color:AMBER_DARK }}>{f.company}</span>
                  {/* Team label for admin view */}
                  {session.role==="admin" && f.team && <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:7, background:CANVAS, color:SLATE, display:"inline-flex", alignItems:"center", gap:5 }}><TeamIcon team={f.team} size={11} color={teamAccent(f.team)} /> {teamLabel(f.team)}</span>}
                </div>
                <span style={{ fontSize:11, color:SLATE_LIGHT }}>{new Date(f.date).toLocaleDateString("en-SG",{day:"2-digit",month:"short"})}</span>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:8 }}>Filled by {f.person}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>{f.amount} L</span>
                <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>S${f.price}</span>
                {cpl && <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:GREEN_LIGHT, color:GREEN_DARK }}>S${cpl}/L</span>}
                {f.mileage && <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:CANVAS, color:"#374151" }}>{f.mileage} km</span>}
                {delta!==null&&delta!==undefined && <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:BLUE_LIGHT, color:BLUE_DARK }}>+{delta.toFixed(0)} km since last fill-up</span>}
              </div>
            </div>
          );
        })}
        {session.role==="admin" && myFillUps.length>0 && (
          <button onClick={()=>{setDeleteTarget(`vehicle:${logVehicleName}`);setDeleteCode("");setDeleteError(null);setScreen("deleteConfirm");}} style={{ width:"100%", marginTop:8, padding:13, borderRadius:12, border:`1.5px solid ${RED}`, background:"white", color:RED, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <AlertTriangle size={15} /> Delete all fuel logs for this vehicle
          </button>
        )}
      </Shell>
    );
  }

  // ── Edit entry ───────────────────────────────────────────────────
  if (screen === "editEntry" && editTarget && editDraft) {
    const accent=teamAccent(editTarget.team);
    const checkInMs=new Date(editDraft.manualCheckIn).getTime();
    const checkOutMs=new Date(editDraft.manualCheckOut).getTime();
    const validTimes=editDraft.manualCheckIn&&editDraft.manualCheckOut&&checkOutMs>checkInMs;
    const liveHours=validTimes?((checkOutMs-checkInMs)/3600000).toFixed(2):null;
    const liveDayType=validTimes?getDayType(checkInMs):null;
    const liveOt=validTimes?calcOT(checkInMs,checkOutMs):null;
    const livePremium=liveDayType?isPremiumDay(liveDayType):false;
    const toggleCrew=(name)=>setEditDraft({...editDraft,crew:editDraft.crew.includes(name)?editDraft.crew.filter((n)=>n!==name):[...editDraft.crew,name]});
    const toggleVehicle=(v)=>setEditDraft({...editDraft,vehicles:editDraft.vehicles.includes(v)?editDraft.vehicles.filter((x)=>x!==v):[...editDraft.vehicles,v]});
    return (
      <Shell>
        <Header title="Edit job entry" onBack={()=>{setEditTarget(null);setEditDraft(null);goBack("jobLogView");}} accent={accent} />
        <div style={{ display:"flex", gap:8, background:BLUE_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:18, fontSize:12, color:BLUE_DARK }}><Pencil size={15} style={{ flexShrink:0, marginTop:1 }} /><span>Editing as {session.name}. Changes to times will immediately recalculate hours and OT.</span></div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Job site</div>
        <input value={editDraft.jobSite} onChange={(e)=>setEditDraft({...editDraft,jobSite:e.target.value})} style={inputStyle} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Check-in date & time</div>
        <input type="datetime-local" value={editDraft.manualCheckIn} onChange={(e)=>setEditDraft({...editDraft,manualCheckIn:e.target.value})} style={datetimeInputStyle} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Check-out date & time</div>
        <input type="datetime-local" value={editDraft.manualCheckOut} onChange={(e)=>setEditDraft({...editDraft,manualCheckOut:e.target.value})} style={{ ...datetimeInputStyle, marginBottom:18 }} />
        {validTimes ? (
          <div style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:14, marginBottom:18, background:"white" }}>
            <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.4 }}>Recalculated live</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, fontWeight:600, padding:"4px 9px", borderRadius:7, background:CANVAS, color:"#374151" }}>{liveHours} hrs total</span>
              <span style={{ fontSize:12, fontWeight:600, padding:"4px 9px", borderRadius:7, background:livePremium?RED_LIGHT:CANVAS, color:livePremium?RED:SLATE }}>{liveDayType}</span>
              {liveOt>0 && <span style={{ fontSize:12, fontWeight:700, padding:"4px 9px", borderRadius:7, background:livePremium?RED_LIGHT:GREEN_LIGHT, color:livePremium?RED:GREEN_DARK }}>{liveOt.toFixed(1)} OT {livePremium?"(2×)":""}</span>}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:18, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} /><span>Check-out must be after check-in.</span></div>
        )}
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.4 }}>Vehicles</div>
        <div style={{ marginBottom:18 }}><ChipGroup options={teamVehicles(editTarget.team).filter((v)=>v!=="Others"||editDraft.vehicles.includes(v))} value={editDraft.vehicles} multi onPick={toggleVehicle} accent={accent} /></div>
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.4 }}>Personnel on this job</div>
        <div style={{ marginBottom:18 }}><ChipGroup options={teamWorkerOptions(editTarget.team,userDirectory).flat} value={editDraft.crew} multi onPick={toggleCrew} accent={accent} /></div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Jobsheet number</div>
        <input value={editDraft.jobsheet} onChange={(e)=>setEditDraft({...editDraft,jobsheet:e.target.value})} style={inputStyle} />
        {editTarget.team!=="jetting" && <><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>PUB disposal number</div><input value={editDraft.pubDisposal} onChange={(e)=>setEditDraft({...editDraft,pubDisposal:e.target.value})} style={inputStyle} /></>}
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Remarks</div>
        <input value={editDraft.remarks} onChange={(e)=>setEditDraft({...editDraft,remarks:e.target.value})} style={{ ...inputStyle, marginBottom:22 }} />
        <PrimaryButton accent={accent} disabled={!validTimes||editDraft.crew.length===0} onClick={()=>{
          const updated={...editTarget,jobSite:editDraft.jobSite,checkInTime:checkInMs,checkOutTime:checkOutMs,hours:liveHours,vehicles:editDraft.vehicles,crew:editDraft.crew,jobsheet:editDraft.jobsheet,pubDisposal:editDraft.pubDisposal,remarks:editDraft.remarks,lastEditedBy:session.name,lastEditedAt:Date.now()};
          if(isBeta) setBetaJobHistory((prev)=>prev.map((j)=>j.id===editTarget.id?updated:j));
          else updateJob(editTarget.id, updated);
          setEditTarget(null); setEditDraft(null); setScreen("jobLogView");
        }}>
          <Check size={16} /> Save changes
        </PrimaryButton>
      </Shell>
    );
  }

  // ── Entry delete confirm ─────────────────────────────────────────
  if (screen === "entryDeleteConfirm" && entryDeleteTarget) {
    const j=entryDeleteTarget;
    const handleConfirm=()=>{
      if(entryDeleteCode!==DELETE_CONFIRM_CODE){setEntryDeleteError("Incorrect code. Deletion cancelled.");return;}
      if(isBeta) setBetaJobHistory((prev)=>prev.filter((job)=>job.id!==j.id));
      else deleteJob(j.id);
      setEntryDeleteTarget(null); setEntryDeleteCode(""); setEntryDeleteError(null);
      setScreen("jobLogView");
    };
    return (
      <Shell>
        <Header title="Confirm deletion" onBack={()=>{setEntryDeleteTarget(null);goBack("jobLogView");}} accent={RED} />
        <div style={{ border:`2px solid ${RED}`, background:RED_LIGHT, borderRadius:16, padding:20, textAlign:"center", marginBottom:18 }}>
          <AlertTriangle size={36} color={RED} style={{ marginBottom:10 }} />
          <div style={{ fontSize:16, fontWeight:800, color:RED, marginBottom:8 }}>Delete this job entry</div>
          <div style={{ fontSize:13, color:"#7A2118", lineHeight:1.6, marginBottom:10 }}>
            Permanently deleting the entry for <strong>{j.jobSite}</strong> ({new Date(j.checkInTime).toLocaleDateString("en-SG",{day:"2-digit",month:"short"})}, checked in by {j.checker}).
          </div>
          <div style={{ fontSize:13, fontWeight:800, color:RED, textTransform:"uppercase", letterSpacing:0.4 }}>This cannot be reversed.</div>
        </div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Type the confirmation code to proceed</div>
        <input value={entryDeleteCode} onChange={(e)=>{setEntryDeleteCode(e.target.value.toUpperCase());setEntryDeleteError(null);}} placeholder="Confirmation code" style={{ ...inputStyle, textAlign:"center", letterSpacing:2, fontWeight:700, fontSize:15, border:`1.5px solid ${entryDeleteError?RED:BORDER}` }} />
        {entryDeleteError && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} /><span>{entryDeleteError}</span></div>}
        <button onClick={handleConfirm} disabled={!entryDeleteCode.trim()} style={{ width:"100%", padding:15, borderRadius:12, border:"none", background:!entryDeleteCode.trim()?"#F0F1F4":RED, color:!entryDeleteCode.trim()?"#B0B4BC":"white", fontSize:15, fontWeight:800, cursor:!entryDeleteCode.trim()?"not-allowed":"pointer", marginBottom:10 }}>Permanently delete</button>
        <button onClick={()=>{setEntryDeleteTarget(null);goBack("jobLogView");}} style={{ width:"100%", padding:13, borderRadius:12, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
      </Shell>
    );
  }

  // ── Beta data tools ──────────────────────────────────────────────
  if (screen === "betaDataTools" && isBeta) {
    return (
      <Shell>
        <Header title="Beta data tools" onBack={()=>goBack("landing")} accent={PURPLE} />
        <div style={{ display:"flex", gap:8, background:PURPLE_LIGHT, borderRadius:12, padding:"11px 13px", marginBottom:18, fontSize:12, color:PURPLE }}><ShieldAlert size={16} style={{ flexShrink:0, marginTop:1 }} /><span>This only affects Beta Tester data. Live company records are never touched here.</span></div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:10, fontWeight:600 }}>{betaJobHistory.length} job record{betaJobHistory.length===1?"":"s"} · {betaFuelHistory.length} fuel record{betaFuelHistory.length===1?"":"s"} currently simulated</div>
        <button onClick={()=>{setDeleteTarget("beta");setDeleteCode("");setDeleteError(null);setScreen("deleteConfirm");}} disabled={betaJobHistory.length===0&&betaFuelHistory.length===0} style={{ width:"100%", padding:15, borderRadius:12, border:`1.5px solid ${RED}`, background:"white", color:RED, fontSize:14, fontWeight:700, cursor:(betaJobHistory.length===0&&betaFuelHistory.length===0)?"not-allowed":"pointer", opacity:(betaJobHistory.length===0&&betaFuelHistory.length===0)?0.4:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <AlertTriangle size={16} /> Delete all Beta Tester logs
        </button>
      </Shell>
    );
  }

  // ── Admin data tools ─────────────────────────────────────────────
  if (screen === "adminDataTools" && isTeamLead) {
    const isAdmin = session.role === "admin";
    const availableTeams = isAdmin ? ["tanker","jetting","watertank"] : mySupTeams;
    const teamCounts=(t)=>({ jobs:jobHistory.filter((j)=>j.team===t).length, fuel:fuelHistory.filter((f)=>f.team===t).length });
    const goDelete=(target)=>{setDeleteTarget(target);setDeleteCode("");setDeleteError(null);setScreen("deleteConfirm");};
    const selectedCounts=dataToolsTeam?teamCounts(dataToolsTeam):null;
    const jobsEmpty=selectedCounts?selectedCounts.jobs===0:true;
    const fuelEmpty=selectedCounts?selectedCounts.fuel===0:true;
    const allEmpty=jobsEmpty&&fuelEmpty;
    const rowBtnStyle=(empty)=>({ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 15px", borderRadius:11, border:`1px solid ${empty?BORDER:RED}`, background:"white", marginBottom:8, cursor:empty?"not-allowed":"pointer", opacity:empty?0.45:1 });
    return (
      <Shell>
        <Header title="Data management" onBack={()=>goBack("adminTools")} accent={RED} />
        <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:12, padding:"11px 13px", marginBottom:18, fontSize:12, color:RED }}><AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }} /><span>These actions permanently delete live company records and cannot be undone.</span></div>
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Select a team</div>
        <select value={dataToolsTeam||""} onChange={(e)=>setDataToolsTeam(e.target.value||null)} style={{ ...inputStyle, marginBottom:dataToolsTeam?18:24, cursor:"pointer" }}>
          <option value="">Choose a team…</option>
          {availableTeams.map((t)=>{ const c=teamCounts(t); return <option key={t} value={t}>{teamLabel(t)} team — {c.jobs} jobs, {c.fuel} fuel</option>; })}
        </select>
        {dataToolsTeam && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}><TeamIcon team={dataToolsTeam} size={16} color={teamAccent(dataToolsTeam)} /><div style={{ fontSize:13, fontWeight:700, color:INK }}>{teamLabel(dataToolsTeam)} team</div></div>
            <button onClick={()=>!jobsEmpty&&goDelete(`jobs:${dataToolsTeam}`)} disabled={jobsEmpty} style={rowBtnStyle(jobsEmpty)}><span style={{ fontSize:13.5, fontWeight:600, color:INK }}>Job logs</span><span style={{ fontSize:11, color:RED, fontWeight:600 }}>{selectedCounts.jobs} records</span></button>
            <button onClick={()=>!fuelEmpty&&goDelete(`fuelteam:${dataToolsTeam}`)} disabled={fuelEmpty} style={rowBtnStyle(fuelEmpty)}><span style={{ fontSize:13.5, fontWeight:600, color:INK }}>Vehicle (fuel) logs</span><span style={{ fontSize:11, color:RED, fontWeight:600 }}>{selectedCounts.fuel} records</span></button>
            <button onClick={()=>!allEmpty&&goDelete(dataToolsTeam)} disabled={allEmpty} style={{ ...rowBtnStyle(allEmpty), background:allEmpty?"white":RED_LIGHT, marginBottom:0 }}><span style={{ fontSize:13.5, fontWeight:700, color:RED }}>All {teamLabel(dataToolsTeam)} logs</span><AlertTriangle size={14} color={RED} /></button>
          </div>
        )}
        {isAdmin && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Delete everything (admin only)</div>
            <button onClick={()=>goDelete("all_live")} style={{ width:"100%", padding:14, borderRadius:12, border:`1.5px solid ${RED}`, background:"white", color:RED, fontSize:13.5, fontWeight:700, cursor:"pointer", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><AlertTriangle size={16} /> Delete ALL live logs (all teams)</button>
            <button onClick={()=>goDelete("everything")} style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:RED, color:"white", fontSize:13.5, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><AlertTriangle size={16} /> Delete EVERYTHING — live + beta</button>
          </>
        )}
      </Shell>
    );
  }

  // ── Shared delete confirm ────────────────────────────────────────
  if (screen === "deleteConfirm" && deleteTarget) {
    const isVehicleTarget=deleteTarget.startsWith("vehicle:");
    const isJobsTarget=deleteTarget.startsWith("jobs:");
    const isFuelTeamTarget=deleteTarget.startsWith("fuelteam:");
    const vehicleName=isVehicleTarget?deleteTarget.slice(8):null;
    const jobsTeam=isJobsTarget?deleteTarget.slice(5):null;
    const fuelTeamName=isFuelTeamTarget?deleteTarget.slice(9):null;
    const labels={ beta:{title:"Delete Beta Tester logs",body:"every simulated job and fuel record under the Beta Tester account"}, tanker:{title:"Delete Tanker team logs",body:"every live job and fuel record for the Tanker team"}, jetting:{title:"Delete Jetting team logs",body:"every live job and fuel record for the Jetting team"}, watertank:{title:"Delete Water Tank team logs",body:"every live job and fuel record for the Water Tank team"}, all_live:{title:"Delete ALL live logs",body:"every live job and fuel record across all three teams"}, everything:{title:"Delete EVERYTHING",body:"every live record across all teams AND every Beta Tester simulated record"} };
    const info=isVehicleTarget?{title:`Delete fuel logs — ${vehicleName}`,body:`every fuel fill-up record for ${vehicleName}`}:isJobsTarget?{title:`Delete ${teamLabel(jobsTeam)} job logs`,body:`every live job record for the ${teamLabel(jobsTeam)} team`}:isFuelTeamTarget?{title:`Delete ${teamLabel(fuelTeamName)} vehicle logs`,body:`every fuel fill-up record for the ${teamLabel(fuelTeamName)} team's vehicles`}:labels[deleteTarget];
    const backScreen=deleteTarget==="beta"?"betaDataTools":isVehicleTarget?"fuelLogView":"adminDataTools";
    const handleConfirm=()=>{
      if(deleteCode!==DELETE_CONFIRM_CODE){setDeleteError("Incorrect code. Deletion cancelled.");return;}
      executeDeletion(deleteTarget);
      setDeleteTarget(null); setDeleteCode(""); setDeleteError(null); setScreen("landing");
    };
    return (
      <Shell>
        <Header title="Confirm deletion" onBack={()=>goBack(backScreen)} accent={RED} />
        <div style={{ border:`2px solid ${RED}`, background:RED_LIGHT, borderRadius:16, padding:20, textAlign:"center", marginBottom:18 }}>
          <AlertTriangle size={36} color={RED} style={{ marginBottom:10 }} />
          <div style={{ fontSize:16, fontWeight:800, color:RED, marginBottom:8 }}>{info.title}</div>
          <div style={{ fontSize:13, color:"#7A2118", lineHeight:1.6, marginBottom:10 }}>You are about to permanently delete {info.body}.</div>
          <div style={{ fontSize:13, fontWeight:800, color:RED, textTransform:"uppercase", letterSpacing:0.4 }}>This action cannot be reversed.</div>
        </div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Enter confirmation code</div>
        <input value={deleteCode} onChange={(e)=>{setDeleteCode(e.target.value.toUpperCase());setDeleteError(null);}} placeholder="Confirmation code" style={{ ...inputStyle, textAlign:"center", letterSpacing:2, fontWeight:700, fontSize:15, border:`1.5px solid ${deleteError?RED:BORDER}` }} />
        {deleteError && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} /><span>{deleteError}</span></div>}
        <button onClick={handleConfirm} disabled={!deleteCode.trim()} style={{ width:"100%", padding:15, borderRadius:12, border:"none", background:!deleteCode.trim()?"#F0F1F4":RED, color:!deleteCode.trim()?"#B0B4BC":"white", fontSize:15, fontWeight:800, cursor:!deleteCode.trim()?"not-allowed":"pointer", marginBottom:10 }}>Permanently delete</button>
        <button onClick={()=>goBack(backScreen)} style={{ width:"100%", padding:13, borderRadius:12, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
      </Shell>
    );
  }

  // ── Admin/supervisor users & PIN management ──────────────────────
  if (screen === "adminUsers" && isTeamLead) {
    const isAdmin = session.role === "admin";
    const sorted = [...userDirectory].sort((a,b) => a.name.localeCompare(b.name));
    // Supervisors can see/edit workers only; admin sees everyone
    const grouped = {
      ...(isAdmin ? { admin: sorted.filter((u) => u.role === "admin") } : {}),
      ...(isAdmin ? { supervisor: sorted.filter((u) => u.role === "supervisor") } : {}),
      tanker:    sorted.filter((u) => u.role === "worker" && u.team === "tanker"),
      jetting:   sorted.filter((u) => u.role === "worker" && u.team === "jetting"),
      watertank: sorted.filter((u) => u.role === "worker" && u.team === "watertank"),
    };
    const sectionLabel = { admin:"Admin", supervisor:"Supervisors", tanker:"Tanker team", jetting:"Jetting team", watertank:"Water Tank team" };
    const canEditUser = (u) => {
      if (isAdmin) return true; // admin can edit anyone except Master Admin PIN (they can, we just allow it)
      return u.role === "worker"; // supervisors only edit workers
    };
    return (
      <Shell>
        <Header title="Manage users & PINs" onBack={()=>goBack("adminTools")} accent={PURPLE} />
        <PrimaryButton accent={PURPLE} onClick={()=>{ setNewUserDraft({ name:"", role:"worker", team:"tanker", pin:"" }); setScreen("adminAddUser"); }}>
          <UserPlus size={16} /> Add new user
        </PrimaryButton>
        {Object.entries(grouped).map(([key, list]) => list.length > 0 && (
          <div key={key} style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:SLATE, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>{sectionLabel[key]}</div>
            {list.map((u) => (
              <div key={u.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", border:`1px solid ${BORDER}`, borderRadius:12, padding:"13px 14px", marginBottom:8, background:"white" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:INK }}>{u.name}</div>
                  <div style={{ fontSize:11, color:SLATE_LIGHT }}>
                    {u.role === "worker" ? `${teamLabel(u.team)} team` : u.role === "supervisor" ? "Supervisor" : "Admin"}
                    {" · "}
                    <span style={{ color: u.pin.startsWith("REVOKED") ? RED : SLATE_LIGHT }}>
                      PIN: {u.pin.startsWith("REVOKED") ? "Revoked" : u.pin}
                    </span>
                  </div>
                </div>
                {canEditUser(u) ? (
                  <button onClick={()=>{setPinEditTarget(u.name);setPinEditValue(u.pin.startsWith("REVOKED")?"":u.pin);setPinEditConfirmAction(null);setNameEditValue(u.name);setScreen("adminPinEdit");}} style={{ border:`1px solid ${BORDER}`, background:"white", borderRadius:9, padding:"9px 16px", minHeight:38, fontSize:12, fontWeight:600, color:PURPLE, cursor:"pointer" }}>Edit</button>
                ) : (
                  <span style={{ fontSize:11, color:SLATE_LIGHT, padding:"7px 12px" }}>—</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </Shell>
    );
  }

  if (screen === "adminAddUser" && isTeamLead && newUserDraft !== null) {
    const isAdmin = session.role === "admin";
    const roleOptions = isAdmin ? ["worker","supervisor"] : ["worker"];
    const nameConflict = newUserDraft.name.trim() && userDirectory.some((u) => u.name.toLowerCase() === newUserDraft.name.trim().toLowerCase());
    const pinConflict = newUserDraft.pin.trim() && userDirectory.some((u) => u.pin === newUserDraft.pin.toUpperCase());
    const pinConflictBeta = newUserDraft.pin.toUpperCase() === "B0000";
    const valid = newUserDraft.name.trim() && newUserDraft.pin.trim().length >= 4 && !nameConflict && !pinConflict && !pinConflictBeta;
    const autoPin = () => {
      const prefix = newUserDraft.role === "supervisor" ? "S" : newUserDraft.team === "tanker" ? "T" : newUserDraft.team === "jetting" ? "J" : "W";
      let pin;
      do { pin = prefix + Math.floor(1000 + Math.random() * 9000); }
      while (userDirectory.some((u) => u.pin === pin));
      setNewUserDraft({ ...newUserDraft, pin });
    };
    return (
      <Shell>
        <Header title="Add new user" onBack={()=>goBack("adminUsers")} accent={PURPLE} />
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Full name</div>
        <input autoFocus value={newUserDraft.name} onChange={(e)=>setNewUserDraft({...newUserDraft,name:e.target.value})} placeholder="e.g. Ahmad bin Razak" style={inputStyle} />
        {nameConflict && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0 }} /><span>A user with this name already exists.</span></div>}

        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Role</div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {roleOptions.map((r) => {
            const isSel = newUserDraft.role === r;
            return (
              <button key={r} onClick={()=>setNewUserDraft({...newUserDraft, role:r, team: r==="supervisor" ? null : (newUserDraft.team||"tanker")})}
                style={{ flex:1, padding:"11px 8px", borderRadius:11, border: isSel?`1.5px solid ${PURPLE}`:`1px solid ${BORDER}`, background: isSel?PURPLE_LIGHT:"white", color: isSel?PURPLE:SLATE, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                {r === "worker" ? "Worker" : "Supervisor"}
              </button>
            );
          })}
        </div>

        {newUserDraft.role === "worker" && (
          <>
            <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Team</div>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              {["tanker","jetting","watertank"].map((t) => {
                const isSel = newUserDraft.team === t;
                const ac = teamAccent(t);
                return (
                  <button key={t} onClick={()=>setNewUserDraft({...newUserDraft,team:t})}
                    style={{ flex:1, padding:"11px 6px", borderRadius:11, border: isSel?`1.5px solid ${ac}`:`1px solid ${BORDER}`, background: isSel?`${ac}12`:"white", color: isSel?ac:SLATE, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    {teamLabel(t)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {newUserDraft.role === "supervisor" && isAdmin && (
          <>
            <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Default teams to monitor</div>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {["tanker","jetting","watertank"].map((t) => {
                const cur = newUserDraft.supervisorTeams || [];
                const isSel = cur.includes(t);
                const ac = teamAccent(t);
                return (
                  <button key={t} onClick={()=>{ const next = isSel ? cur.filter((x)=>x!==t) : [...cur,t]; setNewUserDraft({...newUserDraft, supervisorTeams: next.length ? next : [t]}); }}
                    style={{ flex:1, padding:"11px 6px", borderRadius:11, border: isSel?`1.5px solid ${ac}`:`1px solid ${BORDER}`, background: isSel?`${ac}12`:"white", color: isSel?ac:SLATE, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                    {isSel && <Check size={11} strokeWidth={3} />}{teamLabel(t)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
          <div style={{ fontSize:12, color:SLATE, fontWeight:600, flex:1 }}>PIN</div>
          <button onClick={autoPin} style={{ border:`1px solid ${BORDER}`, background:"white", borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:600, color:BLUE, cursor:"pointer" }}>Auto-generate</button>
        </div>
        <input value={newUserDraft.pin} onChange={(e)=>setNewUserDraft({...newUserDraft,pin:e.target.value.toUpperCase()})} placeholder="e.g. T5523" style={{ ...inputStyle, letterSpacing:2, fontWeight:700 }} />
        {pinConflict && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0 }} /><span>This PIN is already in use.</span></div>}
        {pinConflictBeta && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0 }} /><span>B0000 is reserved for the Beta Tester account.</span></div>}
        {!pinConflict && !pinConflictBeta && newUserDraft.pin.length >= 4 && <div style={{ fontSize:11, color:GREEN_DARK, fontWeight:600, marginBottom:14 }}>✓ PIN is available</div>}

        <PrimaryButton accent={PURPLE} disabled={!valid} onClick={()=>{
          const newUser = {
            name: newUserDraft.name.trim(),
            role: newUserDraft.role,
            team: newUserDraft.role === "worker" ? newUserDraft.team : null,
            pin: newUserDraft.pin.toUpperCase(),
            ...(newUserDraft.role === "supervisor" ? { supervisorTeams: newUserDraft.supervisorTeams || ["tanker","jetting","watertank"] } : {}),
          };
          addUser(newUser);
          setNewUserDraft(null);
          setScreen("adminUsers");
        }}>
          <UserPlus size={16} /> Add user
        </PrimaryButton>
      </Shell>
    );
  }

  if (screen === "adminPinEdit" && pinEditTarget && isTeamLead) {
    const isAdmin = session.role === "admin";
    const target = userDirectory.find((u) => u.name === pinEditTarget);
    const isDuplicate = userDirectory.some((u) => u.name !== pinEditTarget && u.pin === pinEditValue.toUpperCase());
    const isPinBeta = pinEditValue.toUpperCase() === "B0000";
    // Supervisors can edit/revoke/remove workers only; admin can act on anyone (except themselves / Master Admin for remove)
    const canActOnTarget = isAdmin || target?.role === "worker";
    if (!canActOnTarget) { setScreen("adminUsers"); return null; }
    const canRemove = target?.name !== "Master Admin" && target?.name !== session.name;
    return (
      <Shell>
        <Header title={`Edit — ${pinEditTarget}`} onBack={()=>goBack("adminUsers")} accent={PURPLE} />

        {pinEditConfirmAction === "rename" && (
          <ConfirmModal
            title={`Rename ${target?.name} to "${nameEditValue.trim()}"?`}
            body="This updates their name everywhere — job logs, fuel logs, filed entries, leave board, and team assignments. Their PIN and history stay the same, only the name changes. This does not affect past archived snapshots."
            confirmLabel="Rename"
            confirmColor={PURPLE}
            icon={Pencil}
            onCancel={()=>setPinEditConfirmAction(null)}
            onConfirm={()=>{
              renameUser(pinEditTarget, nameEditValue.trim());
              setPinEditTarget(nameEditValue.trim());
              setPinEditConfirmAction(null);
              setScreen("adminUsers");
            }}
          />
        )}
        {pinEditConfirmAction === "remove" && (
          <ConfirmModal
            title={`Remove ${target?.name}?`}
            body="This permanently removes their access to Opsflow. Their existing job and fuel history is kept for records, but they will no longer be able to log in. This cannot be undone from the app — you would need to add them back as a new user."
            confirmLabel="Remove user"
            onCancel={()=>setPinEditConfirmAction(null)}
            onConfirm={()=>{ removeUser(pinEditTarget); setEditUserTeam(undefined); setPinEditConfirmAction(null); setPinEditTarget(null); setScreen("adminUsers"); }}
          />
        )}
        {pinEditConfirmAction === "revoke" && (
          <ConfirmModal
            title={`Revoke ${target?.name}'s access?`}
            body="Their PIN will stop working immediately. The user stays in the system and can be re-issued a new PIN later."
            confirmLabel="Revoke access"
            confirmColor={AMBER_DARK}
            onCancel={()=>setPinEditConfirmAction(null)}
            onConfirm={()=>{
              const revoked = `REVOKED-${Math.floor(Math.random()*90000+10000)}`;
              updateUser(pinEditTarget, { ...userDirectory.find(u=>u.name===pinEditTarget)||{}, pin: revoked });
              setEditUserTeam(undefined); setPinEditConfirmAction(null); setScreen("adminUsers");
            }}
          />
        )}

        <div style={{ border:`1px solid ${BORDER}`, borderRadius:13, padding:"13px 14px", marginBottom:16, background:"white" }}>
          <div style={{ fontSize:14, fontWeight:700, color:INK }}>{target?.name}</div>
          <div style={{ fontSize:11, color:SLATE_LIGHT }}>
            {target?.role === "worker" ? `${teamLabel(target.team)} team` : target?.role === "supervisor" ? "Supervisor" : "Admin"}
          </div>
        </div>

        {/* Name edit */}
        {(() => {
          const trimmed = nameEditValue.trim();
          const nameChanged = trimmed && trimmed !== target?.name;
          const nameDuplicate = nameChanged && userDirectory.some((u) => u.name.toLowerCase() === trimmed.toLowerCase());
          const isSelf = target?.name === session.name;
          return (
            <>
              <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Name</div>
              <input value={nameEditValue || target?.name || ""} onChange={(e)=>setNameEditValue(e.target.value)} placeholder="Full name" disabled={isSelf} style={{ ...inputStyle, ...(isSelf ? { background:CANVAS, color:SLATE_LIGHT } : {}) }} />
              {isSelf && <div style={{ fontSize:11, color:SLATE_LIGHT, marginTop:-10, marginBottom:14 }}>You can't rename your own account while logged in — ask another admin, or log out and back in after they rename you.</div>}
              {nameDuplicate && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }} /><span>Another user already has this name.</span></div>}
              {nameChanged && !nameDuplicate && !isSelf && (
                <button onClick={()=>setPinEditConfirmAction("rename")} style={{ width:"100%", padding:13, borderRadius:12, border:"none", background:PURPLE, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <Pencil size={15} /> Rename to "{trimmed}"
                </button>
              )}
            </>
          );
        })()}

        {/* Role/team edit — admin only */}
        {isAdmin && target?.role === "worker" && (
          <>
            <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Team</div>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              {["tanker","jetting","watertank"].map((t) => {
                const isSel = (editUserTeam !== undefined ? editUserTeam : target.team) === t;
                return (
                  <button key={t} onClick={()=>setEditUserTeam(t)}
                    style={{ flex:1, padding:"11px 6px", borderRadius:11, border: isSel?`1.5px solid ${teamAccent(t)}`:`1px solid ${BORDER}`, background: isSel?`${teamAccent(t)}12`:"white", color: isSel?teamAccent(t):SLATE, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    {teamLabel(t)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ fontSize:12, color:SLATE, marginBottom:3, fontWeight:600 }}>Current PIN</div>
        <div style={{ fontSize:13, color:SLATE_LIGHT, marginBottom:12 }}>{target?.pin.startsWith("REVOKED") ? "Revoked" : target?.pin}</div>
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>New PIN</div>
        <input autoFocus value={pinEditValue} onChange={(e)=>setPinEditValue(e.target.value.toUpperCase())} placeholder="e.g. T8842" style={{ ...inputStyle, letterSpacing:2, fontWeight:700 }} />
        {isDuplicate && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }} /><span>This PIN is already in use by another user.</span></div>}
        {isPinBeta && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }} /><span>B0000 is reserved for the Beta Tester account.</span></div>}
        <PrimaryButton accent={PURPLE} disabled={!pinEditValue.trim() || isDuplicate || isPinBeta} onClick={()=>{
          updateUser(pinEditTarget, { ...userDirectory.find(u=>u.name===pinEditTarget)||{}, pin: pinEditValue.toUpperCase(), ...(editUserTeam!==undefined?{team:editUserTeam}:{}) });
          setEditUserTeam(undefined);
          setScreen("adminUsers");
        }}><KeyRound size={16} /> Save changes</PrimaryButton>

        {/* Revoke access — admin on anyone (except Master Admin); supervisor on workers only */}
        {(isAdmin || target?.role === "worker") && target?.name !== "Master Admin" && !target?.pin.startsWith("REVOKED") && (
          <button onClick={()=>setPinEditConfirmAction("revoke")} style={{ width:"100%", marginTop:8, padding:13, borderRadius:12, border:`1px solid ${AMBER}`, background:"white", color:AMBER_DARK, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            Revoke access (keep user, disable PIN)
          </button>
        )}

        {/* Remove user — admin on anyone (except self/Master Admin); supervisor on workers only */}
        {(isAdmin || target?.role === "worker") && canRemove && (
          <button onClick={()=>setPinEditConfirmAction("remove")} style={{ width:"100%", marginTop:8, padding:13, borderRadius:12, border:`1px solid ${RED}`, background:"white", color:RED, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            Remove user
          </button>
        )}
      </Shell>
    );
  }

  // ── Vehicle management ────────────────────────────────────────────
  if (screen === "adminVehicles" && isTeamLead) {
    const isAdmin = session.role === "admin";
    const availableTeams = isAdmin ? ["tanker","jetting","watertank"] : mySupTeams;
    const isEditing = !!vehicleEditTarget;
    const plateTrimmed = newVehiclePlate.trim();
    const allActivePlates = remoteVehicles.filter(v => v.active !== false).map(v => v.plate.toLowerCase());
    const isDuplicate = plateTrimmed && allActivePlates.includes(plateTrimmed.toLowerCase()) && (!isEditing || vehicleEditTarget.plate.toLowerCase() !== plateTrimmed.toLowerCase());
    const canSave = plateTrimmed.length > 0 && !isDuplicate && availableTeams.includes(newVehicleTeam);

    return (
      <Shell>
        <Header title="Manage vehicles" onBack={()=>goBack("adminTools")} accent={BLUE} />

        {vehicleDeleteTarget && (
          <ConfirmModal
            title={`Remove ${vehicleDeleteTarget.plate}?`}
            body="This removes the vehicle from the check-in and fuel fill-up pickers going forward. Past job and fuel records that reference this vehicle are not affected — the plate number stays in their history."
            confirmLabel="Remove vehicle"
            onCancel={()=>setVehicleDeleteTarget(null)}
            onConfirm={()=>{ removeVehicle(vehicleDeleteTarget.id); setVehicleDeleteTarget(null); }}
          />
        )}

        {/* Add / Edit form */}
        <div style={{ border:`1px solid ${BORDER}`, borderRadius:14, padding:"16px", marginBottom:20, background:"white" }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:INK, marginBottom:12 }}>{isEditing ? `Editing ${vehicleEditTarget.plate}` : "Add a vehicle"}</div>
          <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Plate / vehicle name</div>
          <input value={newVehiclePlate} onChange={(e)=>setNewVehiclePlate(e.target.value)} placeholder="e.g. Small Tanker GBJ5093Y" style={inputStyle} />
          {isDuplicate && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"11px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0 }} /><span>A vehicle with this name already exists.</span></div>}
          <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Team</div>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {availableTeams.map((t) => {
              const accent = teamAccent(t);
              const isSel = newVehicleTeam === t;
              return (
                <button key={t} onClick={()=>setNewVehicleTeam(t)} style={{ flex:1, padding:"10px 6px", borderRadius:10, border: isSel?`1.5px solid ${accent}`:`1px solid ${BORDER}`, background: isSel?`${accent}12`:"white", color: isSel?accent:SLATE, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  {teamLabel(t)}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {isEditing && (
              <button onClick={()=>{setVehicleEditTarget(null);setNewVehiclePlate("");setNewVehicleTeam(availableTeams[0]);}} style={{ flex:1, padding:13, borderRadius:12, border:`1px solid ${BORDER}`, background:"white", color:SLATE, fontSize:13.5, fontWeight:600, cursor:"pointer" }}>Cancel</button>
            )}
            <button onClick={()=>{
              if (isEditing) updateVehicle(vehicleEditTarget.id, { plate: plateTrimmed, team: newVehicleTeam });
              else addVehicle(plateTrimmed, newVehicleTeam);
              setVehicleEditTarget(null); setNewVehiclePlate(""); setNewVehicleTeam(availableTeams[0]);
            }} disabled={!canSave} style={{ flex:2, padding:13, borderRadius:12, border:"none", background: canSave?BLUE:"#F0F1F4", color: canSave?"white":"#B0B4BC", fontSize:13.5, fontWeight:700, cursor: canSave?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              {isEditing ? <><Check size={15} /> Save changes</> : <><Plus size={15} /> Add vehicle</>}
            </button>
          </div>
        </div>

        {/* Vehicle list, grouped by team */}
        {availableTeams.map((t) => {
          const teamVehicleList = remoteVehicles.filter(v => v.team === t && v.active !== false).sort((a,b)=>a.plate.localeCompare(b.plate));
          const accent = teamAccent(t);
          return (
            <div key={t} style={{ marginBottom:22 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <TeamIcon team={t} size={16} color={accent} />
                <span style={{ fontSize:12, fontWeight:700, color:accent, textTransform:"uppercase", letterSpacing:0.4 }}>{teamLabel(t)} · {teamVehicleList.length}</span>
              </div>
              {teamVehicleList.length === 0 && (
                <div style={{ fontSize:12.5, color:SLATE_LIGHT, fontStyle:"italic", padding:"8px 0" }}>No vehicles added yet for this team.</div>
              )}
              {teamVehicleList.map((v) => (
                <div key={v.id} style={{ display:"flex", alignItems:"center", gap:10, border:`1px solid ${BORDER}`, borderRadius:11, padding:"11px 13px", marginBottom:8, background:"white" }}>
                  <Truck size={15} color={accent} style={{ flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:INK }}>{v.plate}</span>
                  <button onClick={()=>{setVehicleEditTarget(v);setNewVehiclePlate(v.plate);setNewVehicleTeam(v.team);}} style={{ border:`1px solid ${BORDER}`, background:"white", borderRadius:8, padding:"7px 12px", fontSize:11.5, fontWeight:600, color:BLUE, cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>setVehicleDeleteTarget(v)} style={{ border:`1px solid ${RED}33`, background:RED_LIGHT, borderRadius:8, padding:"7px 12px", fontSize:11.5, fontWeight:600, color:RED, cursor:"pointer" }}>Remove</button>
                </div>
              ))}
            </div>
          );
        })}

        <div style={{ fontSize:11, color:SLATE_LIGHT, textAlign:"center", marginTop:8 }}>"Others" is always available as a built-in option in every check-in and fuel screen, for vehicles not in this list.</div>
      </Shell>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // LEAVE BOARD
  // ════════════════════════════════════════════════════════════════════
  if (screen === "leaveBoard") {
    const today=sgToday();
    const cutoffTs=new Date(`${today}T00:00:00+08:00`).getTime()+30*86400000;
    const todayTs=new Date(`${today}T00:00:00+08:00`).getTime();
    const todayOut=leaveEntries.filter((e)=>isLeaveActiveToday(e));
    const upcoming=leaveEntries.filter((e)=>{ if(isLeaveActiveToday(e))return false; const start=new Date(`${e.startDate}T00:00:00+08:00`).getTime(); return start>todayTs&&start<=cutoffTs; }).sort((a,b)=>a.startDate.localeCompare(b.startDate));
    const canEdit=(e)=>session.role==="admin"||session.role==="supervisor"||e.name===session.name;
    return (
      <Shell>
        <Header title="Team leave board" onBack={()=>goBack("landing")} accent={GREEN_DARK} />
        {leaveDeleteTarget && (
          <ConfirmModal
            title="Remove this leave entry?"
            body={`This removes ${leaveDeleteTarget.name}'s ${leaveTypeInfo(leaveDeleteTarget.type).label} from the board.`}
            confirmLabel="Remove"
            onCancel={()=>setLeaveDeleteTarget(null)}
            onConfirm={()=>{ deleteLeave(leaveDeleteTarget.id); setLeaveDeleteTarget(null); }}
          />
        )}
        <PrimaryButton accent={GREEN_DARK} onClick={()=>{setLeaveDraft(emptyLeaveDraft());setLeaveEditTarget(null);setScreen("leavePost");}}>
          <CalendarDays size={16} /> Post leave / absence
        </PrimaryButton>
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, margin:"18px 0 8px", textTransform:"uppercase", letterSpacing:0.5 }}>Today — {new Date(`${today}T12:00:00+08:00`).toLocaleDateString("en-SG",{weekday:"short",day:"2-digit",month:"short"})}</div>
        {todayOut.length===0 ? (
          <div style={{ border:`1px solid ${BORDER}`, borderRadius:14, padding:"14px 16px", background:"white", marginBottom:10, fontSize:13, color:SLATE }}>✅ Everyone is in today.</div>
        ) : todayOut.map((e)=>{
          const info=leaveTypeInfo(e.type);
          return (
            <div key={e.id} style={{ border:`1.5px solid ${info.color}33`, borderRadius:14, padding:"13px 15px", background:info.bg, marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>{info.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:INK }}>{e.name}</div>
                <div style={{ fontSize:12, color:info.color, fontWeight:600 }}>{info.label}</div>
                <div style={{ fontSize:11, color:SLATE_LIGHT, marginTop:2 }}>{formatLeaveDate(e.startDate)}{e.startDate!==e.endDate?` → ${formatLeaveDate(e.endDate)}`:""}{" · "}{leaveDayCount(e.startDate,e.endDate)} day{leaveDayCount(e.startDate,e.endDate)!==1?"s":""}</div>
                {e.note&&<div style={{ fontSize:11, color:SLATE, marginTop:2, fontStyle:"italic" }}>"{e.note}"</div>}
              </div>
              {canEdit(e) && (
                <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                  <button onClick={()=>{setLeaveDraft({type:e.type,startDate:e.startDate,endDate:e.endDate,note:e.note||""});setLeaveEditTarget(e.id);setScreen("leavePost");}} style={{ border:`1px solid ${BORDER}`, background:"white", borderRadius:9, padding:"9px 14px", minHeight:36, fontSize:11, fontWeight:600, color:BLUE, cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>setLeaveDeleteTarget(e)} style={{ border:`1px solid ${RED}33`, background:RED_LIGHT, borderRadius:9, padding:"9px 14px", minHeight:36, fontSize:11, fontWeight:600, color:RED, cursor:"pointer" }}>Remove</button>
                </div>
              )}
            </div>
          );
        })}
        {upcoming.length>0 && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:SLATE, margin:"18px 0 8px", textTransform:"uppercase", letterSpacing:0.5 }}>Upcoming — next 30 days</div>
            {upcoming.map((e)=>{
              const info=leaveTypeInfo(e.type);
              return (
                <div key={e.id} style={{ border:`1px solid ${BORDER}`, borderRadius:13, padding:"12px 14px", background:"white", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:20 }}>{info.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:700, color:INK }}>{e.name}</div>
                    <div style={{ fontSize:11.5, color:info.color, fontWeight:600 }}>{info.label}</div>
                    <div style={{ fontSize:11, color:SLATE_LIGHT, marginTop:2 }}>{formatLeaveDate(e.startDate)}{e.startDate!==e.endDate?` → ${formatLeaveDate(e.endDate)}`:""}{" · "}{leaveDayCount(e.startDate,e.endDate)} day{leaveDayCount(e.startDate,e.endDate)!==1?"s":""}</div>
                    {e.note&&<div style={{ fontSize:11, color:SLATE, marginTop:2, fontStyle:"italic" }}>"{e.note}"</div>}
                  </div>
                  {canEdit(e) && (
                    <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                      <button onClick={()=>{setLeaveDraft({type:e.type,startDate:e.startDate,endDate:e.endDate,note:e.note||""});setLeaveEditTarget(e.id);setScreen("leavePost");}} style={{ border:`1px solid ${BORDER}`, background:"white", borderRadius:9, padding:"9px 14px", minHeight:36, fontSize:11, fontWeight:600, color:BLUE, cursor:"pointer" }}>Edit</button>
                      <button onClick={()=>setLeaveDeleteTarget(e)} style={{ border:`1px solid ${RED}33`, background:RED_LIGHT, borderRadius:9, padding:"9px 14px", minHeight:36, fontSize:11, fontWeight:600, color:RED, cursor:"pointer" }}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        {upcoming.length===0&&todayOut.length===0 && <div style={{ border:`1px dashed ${BORDER}`, borderRadius:14, padding:"18px 16px", textAlign:"center", marginBottom:14 }}><div style={{ fontSize:13, color:SLATE_LIGHT }}>No leave posted for the next 30 days.</div></div>}
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, margin:"18px 0 8px", textTransform:"uppercase", letterSpacing:0.5 }}>By team</div>
        {["tanker","jetting","watertank"].map((t)=>{
          const teamWorkerList=userDirectory.filter((u)=>u.role==="worker"&&u.team===t);
          const outNow=teamWorkerList.filter((u)=>todayOut.find((e)=>e.name===u.name)).length;
          return (
            <button key={t} onClick={()=>{setLeaveBoardTeam(t);setScreen("leaveBoardTeam");}} style={tileStyle()}>
              <span style={{ ...tileIconStyle, background:CANVAS }}><TeamIcon team={t} color={teamAccent(t)} /></span>
              <span style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span><span style={tileTitleStyle}>{teamLabel(t)} team</span><span style={tileSubStyle}>{teamWorkerList.length} workers · {outNow>0?`${outNow} out today`:"all in today"}</span></span>
                {outNow>0&&<span style={{ fontSize:11.5, fontWeight:800, color:"white", background:RED, borderRadius:20, padding:"3px 8px", flexShrink:0 }}>{outNow} out</span>}
              </span>
            </button>
          );
        })}
      </Shell>
    );
  }

  if (screen === "leaveBoardTeam" && leaveBoardTeam) {
    const today=sgToday();
    const cutoffTs=new Date(`${today}T00:00:00+08:00`).getTime()+30*86400000;
    const todayTs=new Date(`${today}T00:00:00+08:00`).getTime();
    const teamWorkerList=userDirectory.filter((u)=>u.role==="worker"&&u.team===leaveBoardTeam).sort((a,b)=>a.name.localeCompare(b.name));
    const canEdit=(e)=>session.role==="admin"||session.role==="supervisor"||e.name===session.name;
    return (
      <Shell>
        <Header title={`${teamLabel(leaveBoardTeam)} team — leave`} onBack={()=>goBack("leaveBoard")} accent={teamAccent(leaveBoardTeam)} />
        {leaveDeleteTarget && (
          <ConfirmModal
            title="Remove this leave entry?"
            body={`This removes ${leaveDeleteTarget.name}'s ${leaveTypeInfo(leaveDeleteTarget.type).label} from the board.`}
            confirmLabel="Remove"
            onCancel={()=>setLeaveDeleteTarget(null)}
            onConfirm={()=>{ deleteLeave(leaveDeleteTarget.id); setLeaveDeleteTarget(null); }}
          />
        )}
        <PrimaryButton accent={teamAccent(leaveBoardTeam)} onClick={()=>{setLeaveDraft(emptyLeaveDraft());setLeaveEditTarget(null);setScreen("leavePost");}}>
          <CalendarDays size={16} /> Post leave / absence
        </PrimaryButton>
        <div style={{ fontSize:11, fontWeight:700, color:SLATE, margin:"18px 0 8px", textTransform:"uppercase", letterSpacing:0.5 }}>Worker roster</div>
        {teamWorkerList.map((worker)=>{
          const workerLeave=leaveEntries.filter((e)=>e.name===worker.name).filter((e)=>{ const startTs=new Date(`${e.startDate}T00:00:00+08:00`).getTime(); return isLeaveActiveToday(e)||(startTs>todayTs&&startTs<=cutoffTs); }).sort((a,b)=>a.startDate.localeCompare(b.startDate));
          const activeToday=workerLeave.find((e)=>isLeaveActiveToday(e));
          return (
            <div key={worker.name} style={{ border:`1px solid ${activeToday?RED+"44":BORDER}`, borderRadius:14, marginBottom:10, background:activeToday?RED_LIGHT:"white", overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px", borderBottom:workerLeave.length>0?`1px solid ${BORDER}`:"none" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:activeToday?RED:teamAccent(leaveBoardTeam), display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"white", flexShrink:0 }}>{worker.name.split(" ").map((w)=>w[0]).slice(0,2).join("").toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:INK }}>{worker.name}</div>
                  <div style={{ fontSize:11, color:activeToday?RED:GREEN_DARK, fontWeight:600 }}>{activeToday?"Out today":"In today"}</div>
                </div>
              </div>
              {workerLeave.map((e)=>{
                const info=leaveTypeInfo(e.type); const isActive=isLeaveActiveToday(e);
                return (
                  <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:`1px solid ${BORDER}` }}>
                    <span style={{ fontSize:16 }}>{info.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:info.color }}>{info.label}{isActive?" (active)":""}</div>
                      <div style={{ fontSize:11, color:SLATE_LIGHT }}>{formatLeaveDate(e.startDate)}{e.startDate!==e.endDate?` → ${formatLeaveDate(e.endDate)}`:""}</div>
                    </div>
                    {canEdit(e) && (
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={()=>{setLeaveDraft({type:e.type,startDate:e.startDate,endDate:e.endDate,note:e.note||""});setLeaveEditTarget(e.id);setScreen("leavePost");}} style={{ border:`1px solid ${BORDER}`, background:"white", borderRadius:9, padding:"9px 14px", minHeight:36, fontSize:11, fontWeight:600, color:BLUE, cursor:"pointer" }}>Edit</button>
                        <button onClick={()=>setLeaveDeleteTarget(e)} style={{ border:`1px solid ${RED}33`, background:RED_LIGHT, borderRadius:9, padding:"9px 14px", minHeight:36, fontSize:11, fontWeight:600, color:RED, cursor:"pointer" }}>Remove</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </Shell>
    );
  }

  if (screen === "leavePost" && leaveDraft!==null) {
    const isEditing=!!leaveEditTarget;
    const canPostForOthers=session.role==="admin"||session.role==="supervisor";
    const allPersonNames=[...userDirectory.filter((u)=>u.role==="worker"||u.role==="supervisor").map((u)=>u.name)].sort((a,b)=>a.localeCompare(b));
    const [postForName, setPostForName] = [leaveDraft.forName||session.name, (name)=>setLeaveDraft({...leaveDraft,forName:name})];
    const valid=leaveDraft.type&&leaveDraft.startDate&&leaveDraft.endDate&&leaveDraft.startDate<=leaveDraft.endDate;
    return (
      <Shell>
        <Header title={isEditing?"Edit leave entry":"Post leave / absence"} onBack={()=>goBack("leaveBoard")} accent={GREEN_DARK} />
        {canPostForOthers && !isEditing && (
          <>
            <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Posting for</div>
            <select value={leaveDraft.forName||session.name} onChange={(e)=>setLeaveDraft({...leaveDraft,forName:e.target.value})} style={{ ...inputStyle, cursor:"pointer" }}>
              {allPersonNames.map((n)=><option key={n} value={n}>{n}</option>)}
            </select>
          </>
        )}
        <div style={{ fontSize:12, color:SLATE, marginBottom:8, fontWeight:600 }}>Leave type <span style={{ color:RED }}>*</span></div>
        <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:18 }}>
          {LEAVE_TYPES.map((lt)=>{
            const isSel=leaveDraft.type===lt.key;
            return <button key={lt.key} onClick={()=>setLeaveDraft({...leaveDraft,type:lt.key})} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:12, border:isSel?`1.5px solid ${lt.color}`:`1px solid ${BORDER}`, background:isSel?lt.bg:"white", textAlign:"left", cursor:"pointer" }}>
              <span style={{ fontSize:18 }}>{lt.emoji}</span>
              <span style={{ flex:1, fontSize:14, fontWeight:isSel?700:400, color:isSel?lt.color:INK }}>{lt.label}</span>
              {isSel&&<Check size={16} color={lt.color} strokeWidth={3} />}
            </button>;
          })}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Start date</div><input type="date" value={leaveDraft.startDate} onChange={(e)=>setLeaveDraft({...leaveDraft,startDate:e.target.value,endDate:leaveDraft.endDate||e.target.value})} style={{ ...datetimeInputStyle, marginBottom:0 }} /></div>
          <div><div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>End date</div><input type="date" value={leaveDraft.endDate} min={leaveDraft.startDate} onChange={(e)=>setLeaveDraft({...leaveDraft,endDate:e.target.value})} style={{ ...datetimeInputStyle, marginBottom:0 }} /></div>
        </div>
        {leaveDraft.startDate&&leaveDraft.endDate&&leaveDraft.startDate<=leaveDraft.endDate && <div style={{ fontSize:12, color:SLATE_LIGHT, margin:"6px 0 14px" }}>{leaveDayCount(leaveDraft.startDate,leaveDraft.endDate)} day{leaveDayCount(leaveDraft.startDate,leaveDraft.endDate)!==1?"s":""}</div>}
        <div style={{ fontSize:12, color:SLATE, marginBottom:6, fontWeight:600 }}>Note (optional)</div>
        <input value={leaveDraft.note||""} onChange={(e)=>setLeaveDraft({...leaveDraft,note:e.target.value})} placeholder="e.g. Hospital appointment, family trip…" style={{ ...inputStyle, marginBottom:18 }} />
        {!leaveDraft.type && <div style={{ display:"flex", gap:8, background:AMBER_LIGHT, borderRadius:11, padding:"10px 13px", marginBottom:14, fontSize:12, color:AMBER_DARK }}><AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} /><span>Select a leave type above before posting.</span></div>}
        {leaveDraft.type && (!leaveDraft.startDate || !leaveDraft.endDate) && <div style={{ display:"flex", gap:8, background:AMBER_LIGHT, borderRadius:11, padding:"10px 13px", marginBottom:14, fontSize:12, color:AMBER_DARK }}><AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} /><span>Select a start and end date before posting.</span></div>}
        {leaveDraft.startDate && leaveDraft.endDate && leaveDraft.startDate > leaveDraft.endDate && <div style={{ display:"flex", gap:8, background:RED_LIGHT, borderRadius:11, padding:"10px 13px", marginBottom:14, fontSize:12, color:RED }}><AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} /><span>End date can't be before the start date.</span></div>}
        <PrimaryButton accent={GREEN_DARK} disabled={!valid} onClick={()=>{
          const personName=canPostForOthers?(leaveDraft.forName||session.name):session.name;
          const personUser=userDirectory.find((u)=>u.name===personName);
          const entry={
            id:leaveEditTarget||`leave-${Date.now()}`,
            name:personName, team:personUser?.team||null, role:personUser?.role||"worker",
            type:leaveDraft.type, startDate:leaveDraft.startDate, endDate:leaveDraft.endDate,
            note:leaveDraft.note||"", postedBy:session.name, postedAt:Date.now(),
          };
          if(leaveEditTarget) updateLeave(leaveEditTarget, entry);
          else addLeave(entry);
          setLeaveDraft(null); setLeaveEditTarget(null); setScreen("leaveBoard");
        }}>
          <CalendarDays size={16} /> {isEditing?"Save changes":"Post leave"}
        </PrimaryButton>
        {isEditing && <button onClick={()=>setShowLeavePostDeleteConfirm(true)} style={{ width:"100%", padding:13, borderRadius:12, border:`1px solid ${RED}`, background:"white", color:RED, fontSize:13, fontWeight:700, cursor:"pointer" }}>Delete this entry</button>}
        {showLeavePostDeleteConfirm && (
          <ConfirmModal
            title="Delete this leave entry?"
            body="This permanently removes this leave posting from the board."
            confirmLabel="Delete"
            onCancel={()=>setShowLeavePostDeleteConfirm(false)}
            onConfirm={()=>{ deleteLeave(leaveEditTarget); setShowLeavePostDeleteConfirm(false); setLeaveDraft(null); setLeaveEditTarget(null); setScreen("leaveBoard"); }}
          />
        )}
      </Shell>
    );
  }

  // ── Fallback ─────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ textAlign:"center", padding:"60px 0" }}>
        <div style={{ fontSize:14, color:SLATE, marginBottom:16 }}>Unexpected screen: <code>{screen}</code></div>
        <PrimaryButton onClick={()=>setScreen("landing")}>Back to home</PrimaryButton>
      </div>
    </Shell>
  );
}
