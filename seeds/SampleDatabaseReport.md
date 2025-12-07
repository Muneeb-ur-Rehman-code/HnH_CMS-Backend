# Sample Database Seed Report

**Generated**: 2025-12-07T23:27:13.946Z

---

## Users

| Email | Password | Role | Name | Phone | Status |
|-------|----------|------|------|-------|--------|
| admin@visaconsult.com | Student123! | STUDENT | System Administrator | undefined | ACTIVE |
| manager1@visaconsult.com | Student123! | STUDENT | John Manager | undefined | ACTIVE |
| manager2@visaconsult.com | Student123! | STUDENT | Sarah Smith | undefined | ACTIVE |
| consultant1@visaconsult.com | Staff123! | STAFF | Michael Brown | undefined | ACTIVE |
| consultant2@visaconsult.com | Staff123! | STAFF | Emma Wilson | undefined | ACTIVE |
| accountant1@visaconsult.com | Staff123! | STAFF | David Johnson | undefined | ACTIVE |
| accountant2@visaconsult.com | Staff123! | STAFF | Lisa Anderson | undefined | ACTIVE |
| agent1@visaconsult.com | Staff123! | STAFF | Robert Taylor | undefined | ACTIVE |
| agent2@visaconsult.com | Staff123! | STAFF | Jennifer Martinez | undefined | ACTIVE |
| receptionist1@visaconsult.com | Staff123! | STAFF | Alice Davis | undefined | ACTIVE |
| receptionist2@visaconsult.com | Staff123! | STAFF | Mark Garcia | undefined | ACTIVE |
| student1@email.com | Student123! | STUDENT | Ahmed Khan | undefined | ACTIVE |
| student2@email.com | Student123! | STUDENT | Fatima Ali | undefined | ACTIVE |
| student3@email.com | Student123! | STUDENT | Hassan Ahmed | undefined | ACTIVE |
| student4@email.com | Student123! | STUDENT | Ayesha Malik | undefined | ACTIVE |

## Staff Profiles

| Name | Staff Role | Verification Status |
|------|------------|---------------------|
| Michael Brown | CONSULTANT | VERIFIED |
| Emma Wilson | CONSULTANT | VERIFIED |
| David Johnson | ACCOUNTANT | VERIFIED |
| Lisa Anderson | ACCOUNTANT | VERIFIED |
| Robert Taylor | AGENT | VERIFIED |
| Jennifer Martinez | AGENT | VERIFIED |
| Alice Davis | RECEPTIONIST | VERIFIED |
| Mark Garcia | RECEPTIONIST | VERIFIED |

## Consultant Country Assignments

| Consultant | Countries |
|------------|----------|
| Michael Brown | United Kingdom, Ireland |
| Emma Wilson | Canada, United States |

## Student Profiles

| Name | Nationality | Passport | Education | Institution | GPA | English Test |
|------|-------------|----------|-----------|-------------|-----|-------------|
| System Administrator | Pakistani | AB1234567 | BACHELORS | LUMS | undefined | IELTS (7) |
| John Manager | Pakistani | CD9876543 | MASTERS | IBA Karachi | undefined | TOEFL (105) |
| Sarah Smith | Pakistani | EF5555555 | BACHELORS | NUST | undefined | PTE (65) |
| Ahmed Khan | Pakistani | GH7777777 | BACHELORS | UAF | undefined | IELTS (6.5) |

## Initial Entries

| Email | Name | Phone | Country | University | Source | Status |
|-------|------|-------|---------|------------|--------|--------|
| admin@visaconsult.com | System Administrator | N/A | United Kingdom | Oxford University | ONLINE | APPROVED |
| manager1@visaconsult.com | John Manager | N/A | Canada | University of Toronto | MARKETING | APPROVED |
| manager2@visaconsult.com | Sarah Smith | N/A | Australia | University of Melbourne | WALK_IN | APPROVED |
| newlead1@email.com | Omar Hassan | 923001234590 | Germany | TUM | MARKETING | PENDING |
| newlead2@email.com | Zainab Yousaf | N/A | Ireland | Trinity College Dublin | MARKETING | PENDING |

## Applications

| Student | Consultant | Country | University | Course | Status |
|---------|------------|---------|------------|--------|--------|
| System Administrator | Michael Brown | United Kingdom | Oxford University | MSc Computer Science | GATHERING_INFO |
| John Manager | Emma Wilson | Canada | University of Toronto | MBA | INVOICE_PENDING |

## Invoices

| Invoice# | Application | Accountant | Amount | Type | Status |
|----------|-------------|------------|--------|------|--------|
| INV-202512-0001 | System Administrator | David Johnson | 5000 USD | DIRECT | PENDING |
| INV-202512-0002 | John Manager | Lisa Anderson | 3000 USD | UNIVERSITY | APPROVED |

## Tasks

| Application | Title | Status | Priority | Assigned To | Visible to Student | Due Date |
|-------------|-------|--------|----------|-------------|-------------------|----------|
| System Administrator | Collect Academic Transcripts | PENDING | HIGH | System Administrator | Yes | 2025-12-14 |
| System Administrator | Submit English Test | IN_PROGRESS | HIGH | System Administrator | Yes | 2025-12-21 |
| John Manager | Prepare Statement of Purpose | COMPLETED | MEDIUM | John Manager | Yes | 2025-12-14 |
| John Manager | Internal Review | PENDING | LOW | N/A | No | 2025-12-10 |

## Documents

| Application | Type | Name | File Path | Status | Uploaded By |
|-------------|------|------|-----------|--------|-------------|
| System Administrator | PASSPORT | Passport Copy | uploads/sample/passport.pdf | VERIFIED | System Administrator |
| System Administrator | ACADEMIC_TRANSCRIPT | Bachelor Degree Transcript | uploads/sample/transcript.pdf | UPLOADED | System Administrator |
| System Administrator | ENGLISH_TEST | IELTS Results | N/A | PENDING | N/A |
| John Manager | PASSPORT | Passport Copy | uploads/sample/passport.pdf | VERIFIED | John Manager |
| John Manager | STATEMENT_OF_PURPOSE | Statement of Purpose | uploads/sample/sop.pdf | VERIFIED | John Manager |
| John Manager | CV_RESUME | Curriculum Vitae | uploads/sample/cv.pdf | REJECTED | John Manager |

## Required Sample Files

Place the following files in `uploads/sample/` directory:

- `passport.pdf` - Sample passport document (used by multiple students)
- `transcript.pdf` - Sample academic transcript
- `sop.pdf` - Sample statement of purpose
- `cv.pdf` - Sample curriculum vitae

**Note**: All sample students use the same document files for demonstration purposes.

## Summary

- **Total Users**: 15
  - Admin: 1
  - Managers: 2
  - Staff: 8 (2 Consultants, 2 Accountants, 2 Agents, 2 Receptionists)
  - Students: 4
- **Staff Profiles**: 8
- **Consultant Countries**: 4
- **Student Profiles**: 4
- **Initial Entries**: 5
- **Applications**: 2
- **Invoices**: 2
- **Tasks**: 4
- **Documents**: 6
