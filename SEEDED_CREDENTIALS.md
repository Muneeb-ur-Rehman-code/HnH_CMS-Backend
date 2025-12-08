# Seeded Database Credentials

**Generated**: $(date)  
**Version**: Sample Database Seeder v1.0

---

## Quick Start

Run the seeder script:
```bash
node seeds/seeder-Sample.mjs
```

This will:
1. Connect to MongoDB
2. Clear all previously seeded data (identified by `SEEDERIDENTIFIER`)
3. Create fresh test accounts
4. Generate this file with login credentials

---

## Common Details for All Accounts

| Property | Value |
|----------|-------|
| **Password** | `TestPassword123!` |
| **Phone Number** | `923001234567` |
| **Email** | Verified ✓ |
| **Phone** | Verified ✓ |
| **Status** | ACTIVE |

---

## Staff Accounts (2 per role)

### Admin Users
| Email | Name | Password |
|-------|------|----------|
| admin1@visaconsult.com | Adminst User | TestPassword123! |
| admin2@visaconsult.com | Adminnd User | TestPassword123! |

### Manager Users
| Email | Name | Password |
|-------|------|----------|
| manager1@visaconsult.com | Managerst User | TestPassword123! |
| manager2@visaconsult.com | Managernd User | TestPassword123! |

### Consultant Users
| Email | Name | Password |
|-------|------|----------|
| consultant1@visaconsult.com | Consultantst User | TestPassword123! |
| consultant2@visaconsult.com | Consultantnd User | TestPassword123! |

### Accountant Users
| Email | Name | Password |
|-------|------|----------|
| accountant1@visaconsult.com | Accountantst User | TestPassword123! |
| accountant2@visaconsult.com | Accountantnd User | TestPassword123! |

### Agent Users
| Email | Name | Password |
|-------|------|----------|
| agent1@visaconsult.com | Agentst User | TestPassword123! |
| agent2@visaconsult.com | Agentnd User | TestPassword123! |

### Receptionist Users
| Email | Name | Password |
|-------|------|----------|
| receptionist1@visaconsult.com | Receptionistst User | TestPassword123! |
| receptionist2@visaconsult.com | Receptionistnd User | TestPassword123! |

---

## Student Accounts (2 total)

| Email | Name | Password | Nationality | Education |
|-------|------|----------|-------------|-----------|
| student1@email.com | Studentst User | TestPassword123! | Pakistani | Bachelors |
| student2@email.com | Studentnd User | TestPassword123! | Pakistani | Bachelors |

### Student Details
- **Address**: 123 University Road, Lahore, Punjab, Pakistan 54000
- **Graduation Year**: 2023
- **GPA**: 3.7/4.0
- **English Test**: IELTS - 7.5
- **Passport**: Valid until 2032-01-01

---

## Consultant Countries

Both consultant accounts have access to:
- **United Kingdom**
- **Canada**

---

## Notes

- ✅ All passwords are securely hashed with bcrypt (12 rounds)
- ✅ Email and phone numbers are pre-verified for testing
- ✅ All data is dummy but validates against schema requirements
- ✅ Same phone number used for all accounts to simplify testing
- ✅ Re-running the seeder will clear old test data and create fresh accounts
- ✅ Only seeded data is affected; other database records remain intact

---

## Testing Tips

1. **Login**: Use any email/password combination from above
2. **Staff Features**: Try different staff roles (Admin, Manager, Consultant, etc.)
3. **Student Workflow**: Test with student1@email.com to see applications and tasks
4. **Consultant Workflow**: Use consultant1@visaconsult.com to manage applications
5. **Accountant Workflow**: Use accountant1@visaconsult.com to manage invoices

---

## Troubleshooting

**No MONGO_URI in environment?**
- Check your `.env` file contains `MONGO_URI=...`

**Seeder fails to clear data?**
- Ensure you have write permissions to the database
- Check MongoDB is running and accessible

**Data not appearing?**
- Verify MongoDB connection is successful
- Check browser cache and refresh after seeding
- Ensure database selection is correct

---

Last Updated: See generation date above
