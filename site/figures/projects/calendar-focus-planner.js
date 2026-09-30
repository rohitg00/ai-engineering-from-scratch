window.AIFSProjectFigures.register("pj-calendar-focus-planner-1", {
  "title": "Read explicit calendar intervals",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "parseCalendar(text)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'start',label:'Start: minutes after 09:00',type:'range',value:30,min:0,max:180,step:15},{key:'end',label:'End: minutes after 09:00',type:'range',value:75,min:0,max:240,step:15}],calculate(v){const duration=v.end-v.start;return {summary:duration>0?'A valid half-open event occupies [start, end).':'Reject reversed or zero-length event.',metrics:[{label:'Duration',value:duration+' min'},{label:'Boundary',value:duration>0?'valid':'invalid'}],bars:[{label:'Start offset',value:v.start},{label:'End offset',value:v.end}]};}}
});

window.AIFSProjectFigures.register("pj-calendar-focus-planner-2", {
  "title": "Merge overlaps before finding gaps",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "availableSlots(events, window, bufferMinutes=0)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'second',label:'Second meeting starts: minutes after 09:00',type:'range',value:60,min:0,max:180,step:5},{key:'buffer',label:'Buffer on each side (minutes)',type:'range',value:10,min:0,max:30,step:5}],calculate(v){const intervals=[[Math.max(0,30-v.buffer),75+v.buffer],[Math.max(0,v.second-v.buffer),v.second+60+v.buffer]].sort((a,b)=>a[0]-b[0]);const overlap=Math.max(0,Math.min(intervals[0][1],intervals[1][1])-Math.max(intervals[0][0],intervals[1][0]));const sum=intervals.reduce((n,x)=>n+x[1]-x[0],0),busy=sum-overlap;return {summary:'Union removes '+overlap+' double-counted minutes.',metrics:[{label:'Busy union',value:busy+' min'},{label:'Free in 8 hours',value:480-busy+' min'}],bars:[{label:'Naive duration sum',value:sum},{label:'Actual occupied time',value:busy}],columns:['Start offset','End offset'],rows:intervals};}}
});

window.AIFSProjectFigures.register("pj-calendar-focus-planner-3", {
  "title": "Schedule priorities without pretending everything fits",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "schedule(tasks, events, window, bufferMinutes=0)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'gap',label:'Free contiguous gap (minutes)',type:'range',value:100,min:15,max:180,step:5},{key:'first',label:'High-priority task (minutes)',type:'range',value:75,min:15,max:150,step:5},{key:'second',label:'Second task (minutes)',type:'range',value:45,min:15,max:120,step:5}],calculate(v){let left=v.gap;const rows=[['High priority',v.first],['Second task',v.second]].map(([label,minutes])=>{const fits=minutes<=left;if(fits)left-=minutes;return [label,minutes,fits?'scheduled':'does not fit'];});return {summary:'Never shorten a task to make the plan look complete.',metrics:[{label:'Remaining gap',value:left+' min'}],columns:['Task','Minutes','Decision'],rows,bars:[{label:'Available',value:v.gap},{label:'Used',value:v.gap-left}]};}}
});

window.AIFSProjectFigures.register("pj-calendar-focus-planner-4", {
  "title": "Export a reviewable calendar proposal",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "exportCalendar(plan, createdAt); renderPlan(plan)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'title',label:'Calendar event title',type:'text',value:'Read, then write'}],calculate(v){const escaped=v.title.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const bytes=new TextEncoder().encode('SUMMARY:'+escaped).length;return {summary:bytes>75?'Fold the content line at a UTF-8 boundary before export.':'This SUMMARY fits one iCalendar content line.',metrics:[{label:'UTF-8 bytes',value:bytes},{label:'Needs folding',value:bytes>75?'yes':'no'}],columns:['Layer','Value'],rows:[['Display title',v.title],['Content property','SUMMARY:'+escaped]]};}}
});
