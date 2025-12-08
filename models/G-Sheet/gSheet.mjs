import mongoose from "mongoose";
import { google } from "googleapis";
import path from "path";

const sheetSourceSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },

        spreadsheetId: { type: String, required: true },
        sheetId: { type: String, required: true }, // GID of sheet

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },

        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedAt: { type: Date },

        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        deletedAt: { type: Date },
        isDeleted: { type: Boolean, default: false },
    },
    {
        timestamps: false,
    }
);

sheetSourceSchema.methods.getAuth = function () {
    return new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), "service-account.json"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
};

sheetSourceSchema.methods.importRaw = async function () {
    if (this.isDeleted) throw new Error("Sheet is deleted.");

    const auth = await this.getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Convert sheetId (gid) → sheetName via sheets API
    const meta = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
    });

    const targetSheet = meta.data.sheets.find(
        (s) => s.properties.sheetId === Number(this.sheetId)
    );

    if (!targetSheet) throw new Error("Sheet tab does not exist.");

    const sheetName = targetSheet.properties.title;
    const range = `${sheetName}!A:Z`;

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
    });

    return response.data.values || [];
};


sheetSourceSchema.methods.importParsed = async function () {
    const rows = await this.importRaw();
    if (!rows.length) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const col = {
        email: headers.indexOf("email"),
        firstName: headers.indexOf("firstName"),
        lastName: headers.indexOf("lastName"),
        phone: headers.indexOf("phone"),
        country: headers.indexOf("country"),
        university: headers.indexOf("university"),
    };

    const parsed = dataRows.map((row) => ({
        email: row[col.email] || "",
        firstName: row[col.firstName] || "",
        lastName: row[col.lastName] || "",
        phone: row[col.phone] || "",
        country: row[col.country] || "",
        university: row[col.university] || "",
    }));

    return parsed;
};


sheetSourceSchema.methods.softDelete = async function (userId) {
    this.isDeleted = true;
    this.deletedBy = userId;
    this.deletedAt = new Date();
    await this.save();
    return this;
};


sheetSourceSchema.statics.createFromUrl = async function (
    url,
    name,
    userId
) {
    const spreadsheetRegex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const gidRegex = /[#&]gid=(\d+)/;

    const spreadsheetId = url.match(spreadsheetRegex)?.[1];
    const sheetId = url.match(gidRegex)?.[1];

    if (!spreadsheetId || !sheetId) {
        throw new Error("Invalid Google Sheet URL.");
    }

    return this.create({
        name,
        spreadsheetId,
        sheetId,
        createdBy: userId,
        createdAt: new Date(),
    });
};



sheetSourceSchema.methods.updateFromUrl = async function (url, userId) {
    const spreadsheetRegex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const gidRegex = /[#&]gid=(\d+)/;

    const spreadsheetId = url.match(spreadsheetRegex)?.[1];
    const sheetId = url.match(gidRegex)?.[1];

    if (!spreadsheetId || !sheetId) {
        throw new Error("Invalid Google Sheet URL.");
    }

    this.spreadsheetId = spreadsheetId;
    this.sheetId = sheetId;

    this.updatedBy = userId;
    this.updatedAt = new Date();

    await this.save();

    return this;
};



const SheetSource = mongoose.model("SheetSource", sheetSourceSchema);
export default SheetSource;



//const sheet = await SheetSource.createFromUrl(sheetUrl, "Admissions 2025", adminId);
// const raw = await sheet.importRaw();
// const parsed = await sheet.importParsed();
// await sheet.softDelete(adminId);
// await sheet.updateFromUrl(newSheetUrl, adminId);
