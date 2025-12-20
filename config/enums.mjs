// config/enums.mjs
export const GENDER = Object.freeze({
    MALE: 'MALE',
    FEMALE: 'FEMALE',
    OTHER: 'OTHER',
    PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY'
});

export const EDUCATION_LEVEL = Object.freeze({
    HIGH_SCHOOL: 'HIGH_SCHOOL',
    DIPLOMA: 'DIPLOMA',
    BACHELORS: 'BACHELORS',
    MASTERS: 'MASTERS',
    PHD: 'PHD',
    OTHER: 'OTHER'
});

export const ENGLISH_TEST = Object.freeze({
    NONE: 'NONE',
    IELTS: 'IELTS',
    TOEFL: 'TOEFL',
    PTE: 'PTE',
    DUOLINGO: 'DUOLINGO',
    CAMBRIDGE: 'CAMBRIDGE',
    OTHER: 'OTHER'
});

export const INITIAL_TYPE = Object.freeze({
    STUDY: 'STUDY',
    VISIT: 'VISIT'
});

export const INITIAL_STATUS = Object.freeze({
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    DONE: 'DONE',
    DECLINED: 'DECLINED',
    REFUSED: 'REFUSED'
});
export const PROCESS_STATUS = Object.freeze({

    PROGRESS: 'PROGRESS',    	    // Evrything IN progress

    CANCELLED: 'CANCELLED', 	    // Cancelled by the Accountant, or Consultant, or Agent
    DONE: 'DONE',        	        // Everything DONE

    VERIFIED: 'VERIFIED',    	    // EVERYTING DONE IS ALSO VERIFIED
    REJECTED: 'REJECTED',    	    // EVERYTHING DONE IS ALSO REJECTED (BY MANAGER)

    REFUND_PEND: 'REFUND-PEND',  	// REFUND APPLIED
    REFUND_APPR: 'REFUND-APPR',  	// REFUND APPLIED
    REFUND_REJC: 'REFUND-REJC',  	// REFUND APPLIED
    REFUND_COMP: 'REFUND-COMP',  	// REFUND APPLIED

    WITHDRAWN: 'WITHDRAWN',     	// CACELLED BY THE USER

});

export const INTAKE_PREFERENCE = Object.freeze({
    SPRING: 'SPRING',
    SUMMER: 'SUMMER',
    FALL: 'FALL',
    WINTER: 'WINTER',
    FLEXIBLE: 'FLEXIBLE'
});

export const CURRENCY = Object.freeze({
    USD: 'USD', EUR: 'EUR', GBP: 'GBP', PKR: 'PKR', AED: 'AED', SAR: 'SAR', QAR: 'QAR', KWD: 'KWD', BHD: 'BHD', OMR: 'OMR', AUD: 'AUD', CAD: 'CAD'
});

export default {
    GENDER,
    EDUCATION_LEVEL,
    ENGLISH_TEST,
    INITIAL_TYPE,
    INITIAL_STATUS,
    PROCESS_STATUS,
    INTAKE_PREFERENCE,
    CURRENCY
};
