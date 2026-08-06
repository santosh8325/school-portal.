const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/enroll/unified/single',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => {
        data += chunk;
    });
    res.on('end', () => {
        console.log(res.statusCode, data);
    });
});

req.on('error', e => {
    console.error(e);
});

const formBoundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const payload = {
    student_first_name: "Integration",
    student_last_name: "Test",
    dob: "2010-05-10",
    target_grade: "10-A",
    guardian_first_name: "Parent",
    guardian_last_name: "Test",
    email: "parent.test@example.com",
    signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
};

// we will just use curl to test
