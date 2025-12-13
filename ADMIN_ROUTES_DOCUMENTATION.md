# Admin Routes and Staff Management Documentation

## Overview

This document outlines the comprehensive admin routes and functionality for the HnH CMS Backend system. Admin users have elevated privileges that allow them to:

1. View detailed performance metrics for all staff members
2. Manage staff verification and roles
3. Perform all operations that other staff roles can perform
4. Override restrictions on invoice and process status changes
5. Directly manage tasks, documents, and process assignments

---

## Authentication

All admin routes require:
- Authentication via JWT token
- User role: `STAFF_ROLE.ADMIN`

Middleware: `requireAdmin = [attachUser, requireRole(STAFF_ROLE.ADMIN)]`

---

## 1. STAFF METRICS ENDPOINTS

### 1.1 Get All Staff Metrics (Optionally Filtered by Role)

**Endpoint:** `GET /admin/metrics/staff`

**Query Parameters:**
- `role` (optional): Filter by staff role (ACCOUNTANT, CONSULTANT, AGENT, MANAGER)

**Response:**
Returns array of staff with their role-specific metrics:

**For ACCOUNTANT:**
```json
{
  "staffId": "...",
  "staffRole": "ACCOUNTANT",
  "metrics": {
    "role": "ACCOUNTANT",
    "totalAssigned": 15,
    "byStatus": {
      "PENDING": 3,
      "STUDENT_CONTACTED": 2,
      "pending_progress": 5,
      "PAYMENT_RECEIVED": 2,
      "APPROVED": 10,
      "done_approved": 10,
      "REJECTED": 2,
      "CANCELLED": 1
    },
    "invoices": [...]
  }
}
```

**For CONSULTANT:**
```json
{
  "metrics": {
    "role": "CONSULTANT",
    "totalInitials": 12,
    "initialsByStatus": {
      "APPROVED": 10,
      "PENDING": 2,
      "REJECTED": 0,
      "DECLINED": 0,
      "DONE": 10
    },
    "totalProcesses": 10,
    "processesByStatus": {
      "GATHERING_INFO": 1,
      "INFO_COMPLETE": 1,
      "INVOICE_PENDING": 1,
      "INVOICE_COMPLETE": 2,
      "DOCUMENTS_PENDING": 1,
      "DOCUMENTS_COMPLETE": 2,
      "ADMISSION_PENDING": 1,
      "ADMISSION_COMPLETE": 1,
      "VISA_PENDING": 0,
      "VISA_COMPLETE": 0,
      "SUBMITTED": 0,
      "DONE": 0,
      "REJECTED": 0,
      "CANCELLED": 0
    },
    "totalTasks": 25,
    "tasksByStatus": {
      "PENDING": 10,
      "IN_PROGRESS": 8,
      "COMPLETED": 7,
      "CANCELLED": 0,
      "DECLINED": 0
    },
    "totalDocuments": 18,
    "processes": [...],
    "tasks": [...],
    "documents": [...]
  }
}
```

**For AGENT:**
```json
{
  "metrics": {
    "role": "AGENT",
    "totalProcesses": 8,
    "processesByStatus": {
      "ADMISSION_PENDING": 2,
      "ADMISSION_PROCESSING": 2,
      "ADMISSION_COMPLETE": 1,
      "VISA_PENDING": 1,
      "VISA_PROCESSING": 1,
      "VISA_COMPLETE": 1,
      "SUBMITTED": 0,
      "DONE": 0,
      "REJECTED": 0,
      "CANCELLED": 0
    },
    "totalTasks": 15,
    "tasksByStatus": {
      "PENDING": 5,
      "IN_PROGRESS": 6,
      "COMPLETED": 4,
      "CANCELLED": 0,
      "DECLINED": 0
    },
    "processes": [...],
    "tasks": [...]
  }
}
```

### 1.2 Get Specific Staff Metrics

**Endpoint:** `GET /admin/metrics/staff/:staffId`

Returns detailed metrics for a single staff member.

### 1.3 Get All Staff of a Specific Role

**Endpoint:** `GET /admin/metrics/staff/role/:role`

**Parameters:**
- `role`: Staff role (ACCOUNTANT, CONSULTANT, AGENT, MANAGER)

Returns array of all staff with that role and their metrics.

---

## 2. STAFF MANAGEMENT ENDPOINTS

### 2.1 Get All Staff

**Endpoint:** `GET /admin/staff`

**Query Parameters:**
- `role` (optional): Filter by comma-separated roles (e.g., `ACCOUNTANT,CONSULTANT`)
- `status` (optional): Filter by verification status (PENDING, VERIFIED, REJECTED)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "staffId",
      "userId": { "_id": "userId", "email": "...", "firstName": "...", "lastName": "..." },
      "staffRole": "ACCOUNTANT",
      "verificationStatus": "VERIFIED",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 2.2 Get Specific Staff Member

**Endpoint:** `GET /admin/staff/:staffId`

Returns detailed information for a single staff member.

### 2.3 Verify Staff Member

**Endpoint:** `PATCH /admin/staff/:staffId/verify`

Marks a staff member as verified.

**Response:** Updated staff object.

### 2.4 Reject Staff Member

**Endpoint:** `PATCH /admin/staff/:staffId/reject`

**Request Body:**
```json
{
  "reason": "Does not meet requirements"
}
```

Rejects a staff member with a reason.

### 2.5 Change Staff Role

**Endpoint:** `PATCH /admin/staff/:staffId/role`

**Request Body:**
```json
{
  "staffRole": "MANAGER"
}
```

Changes a staff member's role to a different position.

---

## 3. INVOICE MANAGEMENT ENDPOINTS (Admin Privileges)

### 3.1 Get All Invoices

**Endpoint:** `GET /admin/invoices`

**Query Parameters:**
- `status` (optional): Filter by status (comma-separated)
- `accountantId` (optional): Filter by accountant

**Response:**
```json
{
  "success": true,
  "count": 50,
  "data": [...]
}
```

### 3.2 Get Specific Invoice

**Endpoint:** `GET /admin/invoices/:invoiceId`

### 3.3 Assign/Reassign Accountant to Invoice

**Endpoint:** `PATCH /admin/invoices/:invoiceId/assign-accountant`

**Request Body:**
```json
{
  "accountantId": "staffId"
}
```

**Rules:**
- Can only reassign if invoice status is: PENDING, STUDENT_CONTACTED, PAYMENT_RECEIVED, or REJECTED
- Cannot reassign if status is APPROVED or CANCELLED

### 3.4 Update Invoice Details

**Endpoint:** `PUT /admin/invoices/:invoiceId`

**Request Body:** Any invoice fields to update

**Rules:**
- Cannot edit if status is APPROVED or CANCELLED

### 3.5 Change Invoice Status

**Endpoint:** `PATCH /admin/invoices/:invoiceId/status`

**Request Body:**
```json
{
  "status": "APPROVED",
  "reason": "Payment verified"
}
```

Admin can change invoice status with full privileges.

---

## 4. PROCESS MANAGEMENT ENDPOINTS (Admin Privileges)

### 4.1 Get All Processes

**Endpoint:** `GET /admin/processes`

**Query Parameters:**
- `status` (optional): Filter by status
- `consultantId` (optional): Filter by consultant
- `agentId` (optional): Filter by agent

### 4.2 Get Specific Process

**Endpoint:** `GET /admin/processes/:processId`

### 4.3 Assign/Reassign Agent to Process

**Endpoint:** `PATCH /admin/processes/:processId/assign-agent`

**Request Body:**
```json
{
  "agentId": "staffId"
}
```

**Rules:**
- Can reassign at most stages
- Cannot assign to terminal states: DONE, CANCELLED, REJECTED, DECLINED, REFUND_COMPLETED, REFUND_REJECTED

### 4.4 Update Process Details

**Endpoint:** `PUT /admin/processes/:processId`

**Request Body:** Any process fields to update

**Rules:**
- Cannot edit if in terminal state

### 4.5 Change Process Status

**Endpoint:** `PATCH /admin/processes/:processId/status`

**Request Body:**
```json
{
  "status": "DOCUMENTS_PENDING",
  "notes": "Proceeding to document collection"
}
```

Admin can change process status with full privileges.

---

## 5. TASK MANAGEMENT ENDPOINTS (Admin Privileges)

### 5.1 Get All Tasks

**Endpoint:** `GET /admin/tasks`

**Query Parameters:**
- `status` (optional): Filter by status
- `processId` (optional): Filter by process

### 5.2 Get Specific Task

**Endpoint:** `GET /admin/tasks/:taskId`

### 5.3 Create Task for Process

**Endpoint:** `POST /admin/processes/:processId/tasks`

**Request Body:**
```json
{
  "title": "Document Submission",
  "description": "Student needs to submit passport copy",
  "dueDate": "2025-02-01T00:00:00Z",
  "visibleToStudent": true
}
```

### 5.4 Update Task

**Endpoint:** `PUT /admin/tasks/:taskId`

**Request Body:** Any task fields to update

**Rules:**
- Cannot edit if status is COMPLETED or DECLINED

### 5.5 Change Task Status

**Endpoint:** `PATCH /admin/tasks/:taskId/status`

**Request Body:**
```json
{
  "status": "COMPLETED"
}
```

---

## 6. DOCUMENT MANAGEMENT ENDPOINTS (Admin Privileges)

### 6.1 Get All Documents

**Endpoint:** `GET /admin/documents`

**Query Parameters:**
- `processId` (optional): Filter by process
- `status` (optional): Filter by status

### 6.2 Get Specific Document

**Endpoint:** `GET /admin/documents/:documentId`

---

## 7. ACCOUNTANT NEW FEATURES

### 7.1 Reject a Payment

**Endpoint:** `PATCH /accountant/invoices/:invoiceId/reject`

**Request Body:**
```json
{
  "reason": "Document verification failed, payment method not acceptable"
}
```

**Purpose:** Accountant can reject a payment and set invoice status to REJECTED

**Rules:**
- Required: rejection reason
- Can only reject if accountant is assigned to the invoice
- Can reject if status is: PENDING, STUDENT_CONTACTED, PAYMENT_RECEIVED, or REJECTED

### 7.2 Reject a Process

**Endpoint:** `PATCH /accountant/processes/:processId/reject`

**Request Body:**
```json
{
  "notes": "Cannot proceed with payment - student documents incomplete"
}
```

**Purpose:** Accountant can reject an entire process

**Rules:**
- Required: rejection notes/reason
- Cannot reject if in terminal state (DONE, CANCELLED, DECLINED, REFUND_COMPLETED, REFUND_REJECTED)

---

## 8. ADMIN PRIVILEGE LEVELS

Admins can perform all operations that other staff roles can perform, plus:

### For Accountant Operations:
- ✅ Get all invoices (not just assigned)
- ✅ Change assigned accountant even if already assigned
- ✅ Update invoice info without assignment restriction
- ✅ Change invoice status without the editable status restriction
- ✅ Approve/reject invoices regardless of verification state

### For Consultant Operations:
- ✅ View/manage all initials and processes
- ✅ Create processes for any initial
- ✅ Reject processes at any stage
- ✅ Change process status with full override

### For Agent Operations:
- ✅ Manage all processes in admission/visa stages
- ✅ Create and edit tasks for any process
- ✅ Change agent assignment on processes
- ✅ Update process status

### For Manager Operations:
- ✅ All manager functions (staff management, approvals, role changes)
- ✅ Plus all the above functions for other roles

### Additional Admin Functions:
- ✅ View comprehensive metrics for all staff
- ✅ Manage staff verification and roles
- ✅ Override any status restriction
- ✅ Create tasks on any process
- ✅ View all documents and tasks
- ✅ Reassign staff to invoices/processes at will

---

## 9. ERROR CODES

Common error codes returned by the API:

- `INVALID_ROLE`: Invalid staff role provided
- `INVALID_STATUS`: Cannot perform action in current status
- `NOT_FOUND`: Resource not found
- `ALREADY_VERIFIED`: Staff already verified
- `ALREADY_ASSIGNED`: Invoice/process already assigned
- `VALIDATION_ERROR`: Request validation failed
- `FETCH_ERROR`: Failed to fetch resource
- `UPDATE_ERROR`: Failed to update resource
- `ASSIGN_ERROR`: Failed to assign resource
- `METRICS_ERROR`: Failed to calculate metrics

---

## 10. EXAMPLE WORKFLOWS

### Admin Reviewing Staff Performance

```
1. GET /admin/metrics/staff/role/ACCOUNTANT
   → Returns all accountants with their invoice metrics
   
2. GET /admin/metrics/staff/:accountantId
   → Returns detailed metrics for specific accountant
   
3. Analyze: Total invoices, pending, approved, rejected
4. Take action: Reassign invoices if needed
```

### Admin Fixing an Invoice Assignment

```
1. GET /admin/invoices?status=PENDING
   → Find pending invoices
   
2. PATCH /admin/invoices/:invoiceId/assign-accountant
   → Reassign to different accountant
   
3. PATCH /admin/invoices/:invoiceId/status
   → Update status if needed
```

### Admin Reassigning a Process Agent

```
1. GET /admin/processes/:processId
   → View current agent assignment
   
2. PATCH /admin/processes/:processId/assign-agent
   → Change assigned agent
   
3. POST /admin/processes/:processId/tasks
   → Add tasks if needed
```

---

## Notes

- All timestamps are in ISO 8601 format
- Admin actions are logged with the admin user's ID
- All staff operations are immediately available with no delay
- Metrics include both summary counts and detailed object arrays for flexibility
