import mongoose from "mongoose";


const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        select: false,
    },
    firstName: {
        type: String,
        trim: true,
    },
    lastName: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: ['User', 'Consultant', 'Manager', 'Accountant', 'BackendOfficer', 'Receptionist'],
        default: 'User',
    },
    // Tracks who initially created the user account
    source: {
        type: String,
        enum: ['OnlineRegistration', 'WalkIn', 'MarketingLead', 'ConsultantCreation'],
        required: true,
    },

    isSetupComplete: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });


UserSchema.pre('save', async function(next) {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});


const User = mongoose.model('User', UserSchema);
export default User;