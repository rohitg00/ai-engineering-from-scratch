window.AIFSProjectFigures.register("pj-feedback-theme-board-1", {
  "title": "Import feedback with stable identities",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "parseFeedback(text); validateThemes(value)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'ids',label:'Record IDs (comma separated)',type:'text',value:'f-1,f-2,f-3'}],calculate(v){const ids=v.ids.split(',').map(x=>x.trim());const unique=new Set(ids);const valid=ids.every(Boolean)&&ids.length===unique.size;return {summary:valid?'Stable unique record identities are ready for evidence matching.':'Reject empty or duplicate record identities.',metrics:[{label:'Records',value:ids.length},{label:'Distinct IDs',value:unique.size}],columns:['ID','Occurrences'],rows:[...unique].map(id=>[id,ids.filter(x=>x===id).length])};}}
});

window.AIFSProjectFigures.register("pj-feedback-theme-board-2", {
  "title": "Match phrases while preserving original spans",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "findEvidence(row, phrase)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'text',label:'Feedback text',type:'text',value:'Search shows old pages after updates.'},{key:'phrase',label:'Theme phrase',type:'text',value:'old pages'}],calculate(v){const tokens=[...v.text.matchAll(/[\p{L}\p{N}]+/gu)],needle=[...v.phrase.matchAll(/[\p{L}\p{N}]+/gu)].map(x=>x[0].toLowerCase());let found=null;if(needle.length)for(let i=0;i<=tokens.length-needle.length;i++)if(needle.every((word,j)=>word===tokens[i+j][0].toLowerCase())){found=[tokens[i].index,tokens[i+needle.length-1].index+tokens[i+needle.length-1][0].length];break;}return {summary:found?'A rule matched exact source words; interpretation still needs review.':'No consecutive word match. Keep this record unmatched.',metrics:[{label:'Match',value:found?'yes':'no'}],columns:['Start','End','Quote'],rows:found?[[found[0],found[1],v.text.slice(...found)]]:[]};}}
});

window.AIFSProjectFigures.register("pj-feedback-theme-board-3", {
  "title": "Count evidence without inflating source support",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "buildBoard(rows, themes)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'sources',label:'Sources of matched records',type:'text',value:'interview-a,interview-a,support-b'}],calculate(v){const sources=v.sources.split(',').map(x=>x.trim()).filter(Boolean),unique=new Set(sources);return {summary:'Repeated feedback from one source does not create another source label.',metrics:[{label:'Matched records',value:sources.length},{label:'Distinct sources',value:unique.size}],bars:[{label:'Record count',value:sources.length},{label:'Distinct source count',value:unique.size}],columns:['Source','Records'],rows:[...unique].map(s=>[s,sources.filter(x=>x===s).length])};}}
});

window.AIFSProjectFigures.register("pj-feedback-theme-board-4", {
  "title": "Publish evidence and reviewable investigation drafts",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "draftIssue(theme); renderBoard(board)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'matched',label:'Records with evidence',type:'range',value:4,min:0,max:20,step:1},{key:'unmatched',label:'Unmatched records',type:'range',value:2,min:0,max:20,step:1}],calculate(v){const total=v.matched+v.unmatched,coverage=total?v.matched/total:0;return {summary:total?'Publish unmatched records beside the themes so missing coverage stays visible.':'No records: do not report perfect coverage.',metrics:[{label:'Coverage',value:(coverage*100).toFixed(1)+'%'},{label:'Needs review',value:v.unmatched}],bars:[{label:'Matched',value:v.matched},{label:'Unmatched',value:v.unmatched}]};}}
});
