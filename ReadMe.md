# Backend of a HnH CMS system 
A Backend for a Student Visa Application Processing Agency

## Remaining stuff
- Make better UI for email in `./utils/emailService.mjs`

## Getting Started
Since it is made in JS, it is super easy to get started, 
### Pre-Requesties
You need to have Mongodb and Node Installed.
### Initialization 
Run this command in powershell in disired folder
```
git clone git clone https://github.com/Muneeb-ur-Rehman-code/HnH_CMS-Backend.git
cd HnH_CMS-Backend
npm i 
```
### Seeding 
After the package installation is finished, make a **`.env`** file i root dir and initialize with following data
```
PORT="5000"
MONGO_URI=mongodb://localhost:27017/HnH_CRM_db
JWT_SECRET=super_secre_key
JWT_EXPIRE=7d
```
### Starting Server
Run
```
npm start
```
in terminal 

### Production build
```
npm run
```