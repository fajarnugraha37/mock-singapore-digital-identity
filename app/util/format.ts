export const concatMyInfoRegAddr = (regadd: any) => {
    const line1 = !!regadd.block.value || !!regadd.street.value
        ? `${regadd.block.value} ${regadd.street.value}`
        : ''
    const line2 = !!regadd.floor.value || !!regadd.unit.value
        ? `#${regadd.floor.value}-${regadd.unit.value}`
        : '';
    const line3 = !!regadd.country.desc || !!regadd.postal.value
        ? `${regadd.country.desc} ${regadd.postal.value}`
        : '';

    return `${line1}\n${line2}\n${line3}`;
}

// Refer to sgid myinfo parser
export const formatMobileNumberWithPrefix = (phone: any) => {
    if (!phone || !phone.nbr?.value) {
        return 'NA';
    }

    return phone.prefix?.value && phone.areacode?.value
        ? `${phone.prefix?.value}${phone.areacode?.value} ${phone.nbr?.value}`
        : phone.nbr?.value;
}

// Refer to sgid myinfo parser
export const formatVehicles = (vehicles: Record<string, any>[]) => {
    const vehicleObjects = vehicles?.map((vehicle) => ({
        vehicle_number: vehicle.vehicleno?.value || 'NA',
    })) || '[]';

    return vehicleObjects;
}

export const formatJsonStringify = (value: unknown) => {
    return value == undefined ? 'NA' : JSON.stringify(value);
}

export const defaultUndefinedToNA = (value: unknown) => {
    return value || 'NA'
}

// Refer to https://docs.id.gov.sg/data-catalog
export const sgIDScopeToMyInfoField = (persona: Record<string, any>, scope: string) => {
    switch (scope) {
        // No NRIC as that is always returned by default
        case 'openid':
            return defaultUndefinedToNA(persona.uuid?.value)
        case 'myinfo.name':
            return defaultUndefinedToNA(persona.name?.value)
        case 'myinfo.email':
            return defaultUndefinedToNA(persona.email?.value)
        case 'myinfo.sex':
            return defaultUndefinedToNA(persona.sex?.desc)
        case 'myinfo.race':
            return defaultUndefinedToNA(persona.race?.desc)
        case 'myinfo.mobile_number':
            return defaultUndefinedToNA(persona.mobileno?.nbr?.value)
        case 'myinfo.registered_address':
            return concatMyInfoRegAddr(persona.regadd)
        case 'myinfo.date_of_birth':
            return defaultUndefinedToNA(persona.dob?.value)
        case 'myinfo.passport_number':
            return defaultUndefinedToNA(persona.passportnumber?.value)
        case 'myinfo.passport_expiry_date':
            return defaultUndefinedToNA(persona.passportexpirydate?.value)
        case 'myinfo.nationality':
            return defaultUndefinedToNA(persona.nationality?.desc)
        case 'myinfo.residentialstatus':
            return defaultUndefinedToNA(persona.residentialstatus?.desc)
        case 'myinfo.residential':
            return defaultUndefinedToNA(persona.residential?.desc)
        case 'myinfo.housingtype':
            return defaultUndefinedToNA(persona.housingtype?.desc)
        case 'myinfo.hdbtype':
            return defaultUndefinedToNA(persona.hdbtype?.desc)
        case 'myinfo.birth_country':
            return defaultUndefinedToNA(persona.birthcountry?.desc)
        case 'myinfo.vehicles':
            return formatVehicles(persona.vehicles)
        case 'myinfo.name_of_employer':
            return defaultUndefinedToNA(persona.employment?.value)
        case 'myinfo.workpass_status':
            return defaultUndefinedToNA(persona.passstatus?.value)
        case 'myinfo.workpass_expiry_date':
            return defaultUndefinedToNA(persona.passexpirydate?.value)
        case 'myinfo.marital_status':
            return defaultUndefinedToNA(persona.marital?.desc)
        case 'myinfo.mobile_number_with_country_code':
            return formatMobileNumberWithPrefix(persona.mobileno)
        case 'pocdex.public_officer_details':
            return formatJsonStringify(persona.publicofficerdetails)
        default:
            return 'NA'
    }
}