(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-csv-repair-workbench-1", {"title": "Profile columns and retain original cells", "caption": "Retain exact source cells while counting missing and distinct values.", "steps": [{"label": "Profile columns and retain original cells", "detail": "Retain exact source cells while counting missing and distinct values."}, {"label": "Propose explicit normalization rules", "detail": "Build an explicit ordered recipe from supplied policy."}, {"label": "Preview changes and review ambiguous values", "detail": "Show every changed cell and quarantine uncertain dates."}, {"label": "Export a reusable repair recipe and cleaned table", "detail": "Replay the recipe and validate human cell decisions."}], lab: {controls: [{"key": "cell", "label": "Original place cell", "type": "text", "value": " N. Garden "}, {"key": "alias", "label": "Explicit alias", "type": "text", "value": "N. Garden"}, {"key": "canonical", "label": "Canonical spelling", "type": "text", "value": "North Garden"}, {"key": "date", "label": "Original date cell", "type": "text", "value": "03/04/2026"}, {"key": "approved", "label": "Approve reviewed date", "type": "checkbox", "value": false}, {"key": "reviewed", "label": "Reviewed ISO date", "type": "text", "value": "2026-04-03"}], calculate(values, stepIndex) { const stage = 1;

const trimmed=values.cell.trim(), normalized=trimmed===values.alias?values.canonical:trimmed;
const rawDate=values.date.trim(); let dateValue=rawDate, reason='';
function validDate(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;}
function iso(year,month,day){return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
if(rawDate){
  const slash=rawDate.match(/^(\d+)\/(\d+)\/(\d{4})$/), exact=rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(slash){const a=Number(slash[1]),b=Number(slash[2]),year=Number(slash[3]);if(a<=12&&b<=12&&a!==b)reason='ambiguous date';else{const day=a>12?a:b,month=a>12?b:a;if(validDate(year,month,day))dateValue=iso(year,month,day);else reason='invalid date';}}
  else if(!exact||!validDate(Number(exact[1]),Number(exact[2]),Number(exact[3])))reason='invalid date';
}
const reviewed=values.reviewed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
const accepted=stage===4&&reason&&values.approved&&reviewed&&validDate(Number(reviewed[1]),Number(reviewed[2]),Number(reviewed[3]));
if(accepted){dateValue=values.reviewed;reason='';}
const rows=stage===1?[['place',JSON.stringify(values.cell),'retained exactly'],['date',JSON.stringify(values.date),'retained exactly']]:stage===2?[['trim',JSON.stringify(values.cell),JSON.stringify(trimmed)],['alias',JSON.stringify(trimmed),JSON.stringify(normalized)],['date policy',rawDate,reason||dateValue]]:[['place',JSON.stringify(values.cell),JSON.stringify(normalized)],['date',values.date,reason?'unchanged: '+reason:dateValue]];
return {summary:stage===1?'Original cell strings stay available.':reason?'The date remains pending: '+reason+'.':'Every displayed change follows the explicit recipe or reviewed date.',columns:['Cell / operation','Before','After / state'],rows,metrics:[{label:'Changed cells',value:stage===1?0:Number(values.cell!==normalized)+Number(values.date!==dateValue)},{label:'Pending dates',value:stage<3?0:Number(Boolean(reason))},{label:'Original rows preserved',value:1}]};

}}});
  window.AIFSProjectFigures.register("pj-csv-repair-workbench-2", {"title": "Propose explicit normalization rules", "caption": "Build an explicit ordered recipe from supplied policy.", "steps": [{"label": "Profile columns and retain original cells", "detail": "Retain exact source cells while counting missing and distinct values."}, {"label": "Propose explicit normalization rules", "detail": "Build an explicit ordered recipe from supplied policy."}, {"label": "Preview changes and review ambiguous values", "detail": "Show every changed cell and quarantine uncertain dates."}, {"label": "Export a reusable repair recipe and cleaned table", "detail": "Replay the recipe and validate human cell decisions."}], lab: {controls: [{"key": "cell", "label": "Original place cell", "type": "text", "value": " N. Garden "}, {"key": "alias", "label": "Explicit alias", "type": "text", "value": "N. Garden"}, {"key": "canonical", "label": "Canonical spelling", "type": "text", "value": "North Garden"}, {"key": "date", "label": "Original date cell", "type": "text", "value": "03/04/2026"}, {"key": "approved", "label": "Approve reviewed date", "type": "checkbox", "value": false}, {"key": "reviewed", "label": "Reviewed ISO date", "type": "text", "value": "2026-04-03"}], calculate(values, stepIndex) { const stage = 2;

const trimmed=values.cell.trim(), normalized=trimmed===values.alias?values.canonical:trimmed;
const rawDate=values.date.trim(); let dateValue=rawDate, reason='';
function validDate(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;}
function iso(year,month,day){return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
if(rawDate){
  const slash=rawDate.match(/^(\d+)\/(\d+)\/(\d{4})$/), exact=rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(slash){const a=Number(slash[1]),b=Number(slash[2]),year=Number(slash[3]);if(a<=12&&b<=12&&a!==b)reason='ambiguous date';else{const day=a>12?a:b,month=a>12?b:a;if(validDate(year,month,day))dateValue=iso(year,month,day);else reason='invalid date';}}
  else if(!exact||!validDate(Number(exact[1]),Number(exact[2]),Number(exact[3])))reason='invalid date';
}
const reviewed=values.reviewed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
const accepted=stage===4&&reason&&values.approved&&reviewed&&validDate(Number(reviewed[1]),Number(reviewed[2]),Number(reviewed[3]));
if(accepted){dateValue=values.reviewed;reason='';}
const rows=stage===1?[['place',JSON.stringify(values.cell),'retained exactly'],['date',JSON.stringify(values.date),'retained exactly']]:stage===2?[['trim',JSON.stringify(values.cell),JSON.stringify(trimmed)],['alias',JSON.stringify(trimmed),JSON.stringify(normalized)],['date policy',rawDate,reason||dateValue]]:[['place',JSON.stringify(values.cell),JSON.stringify(normalized)],['date',values.date,reason?'unchanged: '+reason:dateValue]];
return {summary:stage===1?'Original cell strings stay available.':reason?'The date remains pending: '+reason+'.':'Every displayed change follows the explicit recipe or reviewed date.',columns:['Cell / operation','Before','After / state'],rows,metrics:[{label:'Changed cells',value:stage===1?0:Number(values.cell!==normalized)+Number(values.date!==dateValue)},{label:'Pending dates',value:stage<3?0:Number(Boolean(reason))},{label:'Original rows preserved',value:1}]};

}}});
  window.AIFSProjectFigures.register("pj-csv-repair-workbench-3", {"title": "Preview changes and review ambiguous values", "caption": "Show every changed cell and quarantine uncertain dates.", "steps": [{"label": "Profile columns and retain original cells", "detail": "Retain exact source cells while counting missing and distinct values."}, {"label": "Propose explicit normalization rules", "detail": "Build an explicit ordered recipe from supplied policy."}, {"label": "Preview changes and review ambiguous values", "detail": "Show every changed cell and quarantine uncertain dates."}, {"label": "Export a reusable repair recipe and cleaned table", "detail": "Replay the recipe and validate human cell decisions."}], lab: {controls: [{"key": "cell", "label": "Original place cell", "type": "text", "value": " N. Garden "}, {"key": "alias", "label": "Explicit alias", "type": "text", "value": "N. Garden"}, {"key": "canonical", "label": "Canonical spelling", "type": "text", "value": "North Garden"}, {"key": "date", "label": "Original date cell", "type": "text", "value": "03/04/2026"}, {"key": "approved", "label": "Approve reviewed date", "type": "checkbox", "value": false}, {"key": "reviewed", "label": "Reviewed ISO date", "type": "text", "value": "2026-04-03"}], calculate(values, stepIndex) { const stage = 3;

const trimmed=values.cell.trim(), normalized=trimmed===values.alias?values.canonical:trimmed;
const rawDate=values.date.trim(); let dateValue=rawDate, reason='';
function validDate(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;}
function iso(year,month,day){return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
if(rawDate){
  const slash=rawDate.match(/^(\d+)\/(\d+)\/(\d{4})$/), exact=rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(slash){const a=Number(slash[1]),b=Number(slash[2]),year=Number(slash[3]);if(a<=12&&b<=12&&a!==b)reason='ambiguous date';else{const day=a>12?a:b,month=a>12?b:a;if(validDate(year,month,day))dateValue=iso(year,month,day);else reason='invalid date';}}
  else if(!exact||!validDate(Number(exact[1]),Number(exact[2]),Number(exact[3])))reason='invalid date';
}
const reviewed=values.reviewed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
const accepted=stage===4&&reason&&values.approved&&reviewed&&validDate(Number(reviewed[1]),Number(reviewed[2]),Number(reviewed[3]));
if(accepted){dateValue=values.reviewed;reason='';}
const rows=stage===1?[['place',JSON.stringify(values.cell),'retained exactly'],['date',JSON.stringify(values.date),'retained exactly']]:stage===2?[['trim',JSON.stringify(values.cell),JSON.stringify(trimmed)],['alias',JSON.stringify(trimmed),JSON.stringify(normalized)],['date policy',rawDate,reason||dateValue]]:[['place',JSON.stringify(values.cell),JSON.stringify(normalized)],['date',values.date,reason?'unchanged: '+reason:dateValue]];
return {summary:stage===1?'Original cell strings stay available.':reason?'The date remains pending: '+reason+'.':'Every displayed change follows the explicit recipe or reviewed date.',columns:['Cell / operation','Before','After / state'],rows,metrics:[{label:'Changed cells',value:stage===1?0:Number(values.cell!==normalized)+Number(values.date!==dateValue)},{label:'Pending dates',value:stage<3?0:Number(Boolean(reason))},{label:'Original rows preserved',value:1}]};

}}});
  window.AIFSProjectFigures.register("pj-csv-repair-workbench-4", {"title": "Export a reusable repair recipe and cleaned table", "caption": "Replay the recipe and validate human cell decisions.", "steps": [{"label": "Profile columns and retain original cells", "detail": "Retain exact source cells while counting missing and distinct values."}, {"label": "Propose explicit normalization rules", "detail": "Build an explicit ordered recipe from supplied policy."}, {"label": "Preview changes and review ambiguous values", "detail": "Show every changed cell and quarantine uncertain dates."}, {"label": "Export a reusable repair recipe and cleaned table", "detail": "Replay the recipe and validate human cell decisions."}], lab: {controls: [{"key": "cell", "label": "Original place cell", "type": "text", "value": " N. Garden "}, {"key": "alias", "label": "Explicit alias", "type": "text", "value": "N. Garden"}, {"key": "canonical", "label": "Canonical spelling", "type": "text", "value": "North Garden"}, {"key": "date", "label": "Original date cell", "type": "text", "value": "03/04/2026"}, {"key": "approved", "label": "Approve reviewed date", "type": "checkbox", "value": false}, {"key": "reviewed", "label": "Reviewed ISO date", "type": "text", "value": "2026-04-03"}], calculate(values, stepIndex) { const stage = 4;

const trimmed=values.cell.trim(), normalized=trimmed===values.alias?values.canonical:trimmed;
const rawDate=values.date.trim(); let dateValue=rawDate, reason='';
function validDate(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;}
function iso(year,month,day){return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
if(rawDate){
  const slash=rawDate.match(/^(\d+)\/(\d+)\/(\d{4})$/), exact=rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(slash){const a=Number(slash[1]),b=Number(slash[2]),year=Number(slash[3]);if(a<=12&&b<=12&&a!==b)reason='ambiguous date';else{const day=a>12?a:b,month=a>12?b:a;if(validDate(year,month,day))dateValue=iso(year,month,day);else reason='invalid date';}}
  else if(!exact||!validDate(Number(exact[1]),Number(exact[2]),Number(exact[3])))reason='invalid date';
}
const reviewed=values.reviewed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
const accepted=stage===4&&reason&&values.approved&&reviewed&&validDate(Number(reviewed[1]),Number(reviewed[2]),Number(reviewed[3]));
if(accepted){dateValue=values.reviewed;reason='';}
const rows=stage===1?[['place',JSON.stringify(values.cell),'retained exactly'],['date',JSON.stringify(values.date),'retained exactly']]:stage===2?[['trim',JSON.stringify(values.cell),JSON.stringify(trimmed)],['alias',JSON.stringify(trimmed),JSON.stringify(normalized)],['date policy',rawDate,reason||dateValue]]:[['place',JSON.stringify(values.cell),JSON.stringify(normalized)],['date',values.date,reason?'unchanged: '+reason:dateValue]];
return {summary:stage===1?'Original cell strings stay available.':reason?'The date remains pending: '+reason+'.':'Every displayed change follows the explicit recipe or reviewed date.',columns:['Cell / operation','Before','After / state'],rows,metrics:[{label:'Changed cells',value:stage===1?0:Number(values.cell!==normalized)+Number(values.date!==dateValue)},{label:'Pending dates',value:stage<3?0:Number(Boolean(reason))},{label:'Original rows preserved',value:1}]};

}}});
})();
