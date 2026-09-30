(function (scope) {
  'use strict';
  function validate(report, project) {
    if (!report || report.schemaVersion !== 1 || !Array.isArray(report.projects)) throw new Error('Choose a JSON report from the project grader.');
    var matches = report.projects.filter(function (p) { return p.id === project.id; });
    if (matches.length !== 1) throw new Error('This report must contain one result for this project.');
    var result = matches[0];
    if (result.mode !== 'learner') throw new Error('Run the grader against your own workspace without --solution.');
    if (!project.manifestHash || result.manifestHash !== project.manifestHash) throw new Error('The project changed. Run the current grader again.');
    if (!result.allStagesPassed || !result.certificateEligible || !Array.isArray(result.stages) || result.stages.length !== project.stages.length) throw new Error('Pass every stage with --all --strict before importing the report.');
    project.stages.forEach(function (stage, i) {
      var row = result.stages[i];
      if (!row || row.id !== stage.id || row.status !== 'pass' || !Number.isInteger(row.tests) || row.tests < 1 || row.skippedTests !== 0) throw new Error('Every stage needs passing tests with no skips.');
    });
    if (!report.generatedAt || !Number.isFinite(Date.parse(report.generatedAt))) throw new Error('The report has no valid completion date.');
    return result;
  }
  function escape(value) { return String(value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function certificate(report, project, name) {
    var result = validate(report, project);
    var tests = result.stages.reduce(function (sum, stage) { return sum + stage.tests; }, 0);
    return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Project completion</title><style>body{font-family:Georgia,serif;color:#172436;background:#f7f6ef;max-width:900px;margin:70px auto;padding:50px;border:3px solid #3553ff}h1{font-size:44px}h2{font-size:32px}p{line-height:1.7}small{display:block;margin-top:60px}code{overflow-wrap:anywhere}@media print{body{margin:0}}</style><p>AI ENGINEERING FROM SCRATCH</p><h1>Project completion certificate</h1><p>Presented to</p><h2>' + escape(name.trim().slice(0, 100)) + '</h2><p>For completing <strong>' + escape(project.title) + '</strong>.</p><p>' + project.stages.length + ' stages · ' + tests + ' passing tests · ' + escape(report.generatedAt.slice(0, 10)) + '</p><p>Languages: ' + escape(project.languages.join(', ')) + '</p><small>Independent community course. Based on a learner-provided local grader report; not a proctored, independently verified, or vendor credential.</small><p>Curriculum fingerprint: <code>' + escape(result.manifestHash) + '</code></p></html>';
  }
  function mount(host, project) {
    host.innerHTML = '<div class="pj-eyebrow">PROJECT CERTIFICATE</div><h3>Keep evidence of your work.</h3><p>Pass every stage in your workspace, then import the grader report to download a completion certificate.</p><pre class="pj-cmd"><code>python3 scripts/project_test.py ' + escape(project.id) + ' --all --strict --path my-' + escape(project.id) + ' --report completion.json</code></pre><div class="pj-certificate-fields"><label>Your name<input id="pjCertificateName" maxlength="100" autocomplete="name"></label><label>Grader report<input id="pjCertificateFile" type="file" accept="application/json,.json"></label><button type="button" class="pj-action" id="pjCertificateDownload" disabled>Download certificate</button></div><p id="pjCertificateStatus" role="status">Certificates use local evidence. They are not proctored or vendor credentials.</p>';
    var report = null;
    var status = host.querySelector('#pjCertificateStatus');
    var button = host.querySelector('#pjCertificateDownload');
    var name = host.querySelector('#pjCertificateName');
    function enabled() { button.disabled = !report || !name.value.trim(); }
    name.addEventListener('input', enabled);
    host.querySelector('#pjCertificateFile').addEventListener('change', async function (event) {
      report = null; enabled();
      try {
        var file = event.target.files[0];
        if (!file || file.size > 2000000) throw new Error('Choose a grader JSON report smaller than 2 MB.');
        var parsed = JSON.parse(await file.text());
        validate(parsed, project); report = parsed;
        status.textContent = 'All stages passed in the imported learner report. Enter your name to download.';
      } catch (error) { status.textContent = error.message; }
      enabled();
    });
    button.addEventListener('click', function () {
      if (button.disabled) return;
      var url = URL.createObjectURL(new Blob([certificate(report, project, name.value)], { type: 'text/html' }));
      var link = document.createElement('a'); link.href = url; link.download = project.id + '-certificate.html'; link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }
  var api = { validate: validate, certificate: certificate, mount: mount };
  if (typeof module !== 'undefined') module.exports = api;
  else scope.AIFSProjectCertificates = api;
}(typeof window !== 'undefined' ? window : globalThis));
