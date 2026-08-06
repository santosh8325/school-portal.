
// Basic RBAC for UI
fetch('/api/auth/me').then(r => {
    if(!r.ok) return;
    r.json().then(u => {
        if(u && u.role && !['admin', 'registrar', 'principal'].includes(u.role.toLowerCase())) {
            document.getElementById('tab-bulk').style.display = 'none';
        }
    });
});

const apiBase = '/api/enroll/unified';

// Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`content-${tabId}`).classList.add('active');
}

// Wizard Logic
function nextStep(step) {
    if (step === 5) populateReviewCard();
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
}

function populateReviewCard() {
    const card = document.getElementById('review-card');
    card.innerHTML = `
        <strong>Student:</strong> ${document.getElementById('s_first_name').value} ${document.getElementById('s_last_name').value} <br>
        <strong>Grade:</strong> ${document.getElementById('s_target_grade').value} <br>
        <strong>Guardian:</strong> ${document.getElementById('g_first_name').value} ${document.getElementById('g_last_name').value} <br>
        <strong>Email:</strong> ${document.getElementById('g_email').value}
    `;
}

// File Vault Drag & Drop
const vaultDropzone = document.getElementById('file-dropzone');
const vaultInput = document.getElementById('file-upload');
const fileList = document.getElementById('file-list');
let uploadedFiles = [];

vaultDropzone.addEventListener('click', () => vaultInput.click());
vaultDropzone.addEventListener('dragover', (e) => { e.preventDefault(); vaultDropzone.style.borderColor = '#00B4D8'; });
vaultDropzone.addEventListener('dragleave', () => vaultDropzone.style.borderColor = '#ccc');
vaultDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    vaultDropzone.style.borderColor = '#ccc';
    handleFiles(e.dataTransfer.files);
});
vaultInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
    for(let f of files) {
        if(f.size > 5 * 1024 * 1024) { alert(`${f.name} exceeds 5MB`); continue; }
        uploadedFiles.push(f);
        const li = document.createElement('li');
        li.textContent = f.name;
        fileList.appendChild(li);
    }
}

// Signature Canvas
const canvas = document.getElementById('signature-pad');
const signaturePad = new SignaturePad(canvas);
function clearSignature() { signaturePad.clear(); }

// Fix canvas scaling for retina displays
function resizeCanvas() {
    const ratio =  Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear();
}
window.addEventListener("resize", resizeCanvas);
// Call resize on a short timeout to ensure layout is done
setTimeout(resizeCanvas, 100);

// Single Form Submit
document.getElementById('single-enrollment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (signaturePad.isEmpty()) { alert('Please provide a digital signature.'); return; }
    if (!document.getElementById('terms_accept').checked) return;

    const payload = {
        student_first_name: document.getElementById('s_first_name').value,
        student_last_name: document.getElementById('s_last_name').value,
        dob: document.getElementById('s_dob').value,
        gender: document.getElementById('s_gender').value,
        blood_group: document.getElementById('s_blood_group').value,
        nationality: document.getElementById('s_nationality').value,
        primary_language: document.getElementById('s_primary_language').value,
        target_grade: document.getElementById('s_target_grade').value,
        previous_school: document.getElementById('s_prev_school').value,
        last_grade_passed: document.getElementById('s_last_grade').value,
        transfer_certificate_number: document.getElementById('s_tc_number').value,

        guardian_type: document.getElementById('g_type').value,
        guardian_first_name: document.getElementById('g_first_name').value,
        guardian_last_name: document.getElementById('g_last_name').value,
        relationship: document.getElementById('g_relationship').value,
        occupation: document.getElementById('g_occupation').value,
        email: document.getElementById('g_email').value,
        mobile_number: document.getElementById('g_mobile').value,
        address_street: document.getElementById('g_street').value,
        address_city: document.getElementById('g_city').value,
        address_zip: document.getElementById('g_zip').value,

        allergies: document.getElementById('m_allergies').value,
        chronic_conditions: document.getElementById('m_chronic').value,
        emergency_medical_auth: document.getElementById('m_auth').checked,
        sen_notes: document.getElementById('m_sen').value,
        signature: signaturePad.toDataURL()
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    uploadedFiles.forEach(f => formData.append('documents', f));

    const btn = document.getElementById('btn-submit-single');
    btn.disabled = true; btn.textContent = 'Submitting...';

    try {
        const res = await fetch(`${apiBase}/single`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        const msg = document.getElementById('single-result-msg');
        if (res.ok) {
            msg.innerHTML = `<span style="color: green;">✅ Application Approved! Reference ID: ${data.reference_id}</span>`;
            document.getElementById('single-enrollment-form').reset();
            signaturePad.clear();
            fileList.innerHTML = '';
            uploadedFiles = [];
            setTimeout(() => nextStep(1), 3000);
        } else {
            msg.innerHTML = `<span style="color: red;">❌ Error: ${data.error}</span>`;
        }
    } catch(err) {
        document.getElementById('single-result-msg').innerHTML = `<span style="color: red;">❌ Network Error</span>`;
    }
    btn.disabled = false; btn.textContent = 'Submit Application';
});

// ==========================================
// MODULE B: Mass Student Onboarding Engine
// ==========================================
let bulkValidatedData = [];
const bulkDropzone = document.getElementById('bulk-dropzone');
const bulkInput = document.getElementById('bulk-upload');

bulkDropzone.addEventListener('click', () => bulkInput.click());
bulkDropzone.addEventListener('dragover', (e) => { e.preventDefault(); bulkDropzone.style.borderColor = '#F77F00'; });
bulkDropzone.addEventListener('dragleave', () => bulkDropzone.style.borderColor = '#ccc');
bulkDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    bulkDropzone.style.borderColor = '#ccc';
    if(e.dataTransfer.files.length) handleBulkFile(e.dataTransfer.files[0]);
});
bulkInput.addEventListener('change', (e) => {
    if(e.target.files.length) handleBulkFile(e.target.files[0]);
});

async function handleBulkFile(file) {
    if (file.size > 20 * 1024 * 1024) { alert('File exceeds 20MB limit.'); return; }

    const formData = new FormData();
    formData.append('file', file);

    bulkDropzone.innerHTML = 'Analyzing...';
    try {
        const res = await fetch(`${apiBase}/bulk/preview`, { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            bulkDropzone.innerHTML = 'Drag and drop CSV/XLSX file here (Max 20MB)';
            renderPreviewGrid(data.preview);
        } else {
            alert('Error: ' + data.error);
            bulkDropzone.innerHTML = 'Drag and drop CSV/XLSX file here (Max 20MB)';
        }
    } catch(err) {
        alert('Network Error');
        bulkDropzone.innerHTML = 'Drag and drop CSV/XLSX file here (Max 20MB)';
    }
}

function renderPreviewGrid(previewRows) {
    document.getElementById('preview-container').style.display = 'block';
    const thead = document.getElementById('preview-headers');
    const tbody = document.getElementById('preview-body');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if(!previewRows || !previewRows.length) return;

    // Store in memory for commit
    bulkValidatedData = previewRows;

    // Render Headers (excluding internal _id)
    const headers = Object.keys(previewRows[0].data).filter(k => k !== '_id');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.replace(/_/g, ' ');
        thead.appendChild(th);
    });

    // Render Rows
    previewRows.forEach((rowObj, rowIndex) => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            const val = rowObj.data[h] || '';
            td.textContent = val;
            td.dataset.field = h;
            td.dataset.index = rowIndex;

            // Check for error in this cell
            if (rowObj.errors && rowObj.errors[h]) {
                td.classList.add('error-cell');
                td.title = rowObj.errors[h]; // Tooltip
            }

            // Enable in-grid error correction
            td.addEventListener('dblclick', function() {
                const currentVal = this.textContent;
                this.innerHTML = `<input type="text" value="${currentVal}" style="width:100%; padding:2px; margin:0;">`;
                const input = this.querySelector('input');
                input.focus();

                input.addEventListener('blur', function() {
                    const newVal = this.value;
                    td.textContent = newVal;
                    // Update data model
                    bulkValidatedData[rowIndex].data[h] = newVal;
                    // Remove error styling (optimistic UX, server validates again)
                    td.classList.remove('error-cell');
                    td.title = '';
                });

                input.addEventListener('keydown', function(e) {
                    if(e.key === 'Enter') this.blur();
                });
            });

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-commit-bulk').addEventListener('click', async () => {
    const studentsToCommit = bulkValidatedData.map(r => r.data);
    if (!studentsToCommit.length) return;

    const btn = document.getElementById('btn-commit-bulk');
    btn.disabled = true; btn.textContent = 'Processing Batch...';

    try {
        const res = await fetch(`${apiBase}/bulk/commit`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ students: studentsToCommit })
        });
        const data = await res.json();
        const msg = document.getElementById('bulk-result-msg');

        if (res.ok) {
            msg.innerHTML = `<span style="color: green;">✅ Successfully Enrolled: ${data.successCount} | Skipped (Existing): ${data.skippedCount}</span>`;
            document.getElementById('preview-container').style.display = 'none';
        } else {
            msg.innerHTML = `<span style="color: red;">❌ Batch Error: ${data.error}</span>`;
        }
    } catch(err) {
        document.getElementById('bulk-result-msg').innerHTML = `<span style="color: red;">❌ Network Error</span>`;
    }
    btn.disabled = false; btn.textContent = 'Process Bulk Enrollment';
});
