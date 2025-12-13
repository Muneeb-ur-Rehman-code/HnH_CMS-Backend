# API Request Examples

## Base URL
```
http://localhost:3000/api
```

All requests require JWT token in Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Accountant Endpoints

### 1. Reject a Payment

```bash
curl -X PATCH http://localhost:3000/api/accountant/invoices/123456/reject \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Payment method documentation incomplete, student needs to resubmit"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "123456",
    "status": "REJECTED",
    "reviewedAt": "2025-01-15T10:30:00Z",
    "reviewedBy": "accountantId",
    "reviewReason": "Payment method documentation incomplete, student needs to resubmit"
  }
}
```

### 2. Reject a Process

```bash
curl -X PATCH http://localhost:3000/api/accountant/processes/789012/reject \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Cannot proceed with payment processing - student has backed out"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "789012",
    "status": "REJECTED",
    "reason": "Cannot proceed with payment processing - student has backed out",
    "statusHistory": [
      {
        "status": "REJECTED",
        "changedAt": "2025-01-15T10:35:00Z",
        "notes": "Cannot proceed with payment processing - student has backed out"
      }
    ]
  }
}
```

---

## Admin Metrics Endpoints

### 1. Get All Staff with Metrics

```bash
curl -X GET "http://localhost:3000/api/admin/metrics/staff" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "staffId": "acc123",
      "staffRole": "ACCOUNTANT",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Smith",
      "verificationStatus": "VERIFIED",
      "metrics": {
        "role": "ACCOUNTANT",
        "totalAssigned": 15,
        "byStatus": {
          "PENDING": 2,
          "STUDENT_CONTACTED": 3,
          "pending_progress": 5,
          "PAYMENT_RECEIVED": 2,
          "APPROVED": 8,
          "done_approved": 8,
          "REJECTED": 2,
          "CANCELLED": 1
        }
      }
    },
    {
      "staffId": "con456",
      "staffRole": "CONSULTANT",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "metrics": {
        "role": "CONSULTANT",
        "totalInitials": 10,
        "initialsByStatus": {
          "APPROVED": 9,
          "PENDING": 1,
          "REJECTED": 0,
          "DECLINED": 0,
          "DONE": 9
        },
        "totalProcesses": 8,
        "totalTasks": 20,
        "totalDocuments": 15
      }
    }
  ]
}
```

### 2. Get Accountants Only

```bash
curl -X GET "http://localhost:3000/api/admin/metrics/staff?role=ACCOUNTANT" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 3. Get Specific Staff Detailed Metrics

```bash
curl -X GET "http://localhost:3000/api/admin/metrics/staff/acc123 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response includes:**
- Full staff details
- Complete metrics breakdown
- All related invoices/processes/tasks/documents

### 4. Get All Consultants with Metrics

```bash
curl -X GET "http://localhost:3000/api/admin/metrics/staff/role/CONSULTANT" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Returns all consultants with their process, task, document, and initial metrics.

---

## Admin Staff Management Endpoints

### 1. Get All Staff

```bash
curl -X GET "http://localhost:3000/api/admin/staff" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**With Filters:**
```bash
curl -X GET "http://localhost:3000/api/admin/staff?role=ACCOUNTANT,CONSULTANT&status=VERIFIED" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2. Verify a Staff Member

```bash
curl -X PATCH "http://localhost:3000/api/admin/staff/staff123/verify" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 3. Reject a Staff Member

```bash
curl -X PATCH "http://localhost:3000/api/admin/staff/staff123/reject" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Does not meet qualifications or incomplete documentation"
  }'
```

### 4. Change Staff Role

```bash
curl -X PATCH "http://localhost:3000/api/admin/staff/staff123/role" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "staffRole": "MANAGER"
  }'
```

---

## Admin Invoice Management Endpoints

### 1. Get All Invoices

```bash
curl -X GET "http://localhost:3000/api/admin/invoices" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2. Filter Invoices by Status

```bash
curl -X GET "http://localhost:3000/api/admin/invoices?status=PENDING,REJECTED" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 3. Get Invoices by Accountant

```bash
curl -X GET "http://localhost:3000/api/admin/invoices?accountantId=acc123" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 4. Assign/Reassign Accountant to Invoice

```bash
curl -X PATCH "http://localhost:3000/api/admin/invoices/inv123/assign-accountant" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountantId": "newAccountantId"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "inv123",
    "accountantId": "newAccountantId",
    "status": "PENDING"
  }
}
```

### 5. Update Invoice Details

```bash
curl -X PUT "http://localhost:3000/api/admin/invoices/inv123" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "USD",
    "dueDate": "2025-02-15T00:00:00Z"
  }'
```

### 6. Change Invoice Status

```bash
curl -X PATCH "http://localhost:3000/api/admin/invoices/inv123/status" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "reason": "Payment verified by admin"
  }'
```

---

## Admin Process Management Endpoints

### 1. Get All Processes

```bash
curl -X GET "http://localhost:3000/api/admin/processes" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2. Filter Processes by Status

```bash
curl -X GET "http://localhost:3000/api/admin/processes?status=ADMISSION_PENDING,DOCUMENTS_PENDING" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 3. Get Processes by Consultant

```bash
curl -X GET "http://localhost:3000/api/admin/processes?consultantId=con123" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 4. Assign/Reassign Agent to Process

```bash
curl -X PATCH "http://localhost:3000/api/admin/processes/proc123/assign-agent" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent456"
  }'
```

### 5. Update Process Details

```bash
curl -X PUT "http://localhost:3000/api/admin/processes/proc123" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetCourse": "Master of Business Administration",
    "intakePreference": "FALL",
    "intakeYear": 2025
  }'
```

### 6. Change Process Status

```bash
curl -X PATCH "http://localhost:3000/api/admin/processes/proc123/status" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DOCUMENTS_PENDING",
    "notes": "Student has completed initial information gathering"
  }'
```

---

## Admin Task Management Endpoints

### 1. Get All Tasks

```bash
curl -X GET "http://localhost:3000/api/admin/tasks" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2. Get Tasks by Process

```bash
curl -X GET "http://localhost:3000/api/admin/tasks?processId=proc123" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 3. Create Task for Process

```bash
curl -X POST "http://localhost:3000/api/admin/processes/proc123/tasks" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Submit Passport Copy",
    "description": "Student needs to submit a clear scanned copy of passport",
    "dueDate": "2025-02-01T00:00:00Z",
    "visibleToStudent": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "task789",
    "processId": "proc123",
    "title": "Submit Passport Copy",
    "description": "Student needs to submit a clear scanned copy of passport",
    "status": "PENDING",
    "dueDate": "2025-02-01T00:00:00Z",
    "visibleToStudent": true,
    "createdAt": "2025-01-15T10:45:00Z"
  }
}
```

### 4. Update Task

```bash
curl -X PUT "http://localhost:3000/api/admin/tasks/task789" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Submit Updated Passport Copy",
    "dueDate": "2025-02-10T00:00:00Z"
  }'
```

### 5. Change Task Status

```bash
curl -X PATCH "http://localhost:3000/api/admin/tasks/task789/status" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED"
  }'
```

---

## Admin Document Management Endpoints

### 1. Get All Documents

```bash
curl -X GET "http://localhost:3000/api/admin/documents" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2. Get Documents by Process

```bash
curl -X GET "http://localhost:3000/api/admin/documents?processId=proc123" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 3. Get Specific Document

```bash
curl -X GET "http://localhost:3000/api/admin/documents/doc456" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## Error Response Examples

### Invalid Role
```json
{
  "success": false,
  "message": "Invalid staff role: INVALID_ROLE",
  "code": "INVALID_ROLE"
}
```

### Resource Not Found
```json
{
  "success": false,
  "message": "Invoice not found",
  "code": "NOT_FOUND"
}
```

### Invalid Status
```json
{
  "success": false,
  "message": "Cannot change status of an invoice that is already APPROVED.",
  "code": "INVALID_STATUS"
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Rejection reason is required.",
  "code": "REASON_REQUIRED"
}
```

---

## Notes

- All IDs are MongoDB ObjectIds
- All dates are in ISO 8601 format (UTC)
- Pagination not implemented - all results returned
- Use `count` in response to determine result set size
- Error codes help with client-side error handling
