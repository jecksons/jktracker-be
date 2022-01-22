
const {BaseError} = require('./error_classes');

const SQL_INSERT_UNIQUE_CODE =  `
        insert into unique_code
        (
            code_string
        )
        select
            ?
        where
            not exists
                    (
                        select
                            1
                        from
                            unique_code unc
                        where
                            unc.code_string = ?
                    )    
    `;


class UtilsLib{


    static roundTo(num, decimals) {
        let decimalPow = 2;
        if (!(decimals >= 0)) {
            decimalPow = decimals;
        }
        return Math.round( ( num + Number.EPSILON ) * Math.pow(10, decimalPow) ) / Math.pow(10, decimalPow);        
    }

    static getRandomInt(min, max){
        return Math.round(Math.random() * (max-min))+min;
    }

    static async getDemoIdBusinesss(){
        return 1;
    }
    
    static getRandomStr(length){
        let strRes = '';                
        while (strRes.length < length) {
            let iRnd = UtilsLib.getRandomInt(1, 50);
            if (iRnd <= 25) {
                strRes += String.fromCharCode(iRnd + 64);
            } else {
                strRes += String.fromCharCode(iRnd + 96 - 25);
            }
        }
        return strRes;
    }

    static getTruncDate(dtBase) {
        return new Date(dtBase.getFullYear(), dtBase.getMonth(), dtBase.getDate());
    }

    static async getUniqueString(length, conn, shouldUpper) {
        let strRes = '';
        const maxTries = 50;
        let actualTry = 0;
        while (actualTry < maxTries) {
            actualTry++;
            strRes = UtilsLib.getRandomStr(length);
            if (shouldUpper) {
                strRes = strRes.toUpperCase();
            }
            const rows = await conn.query(SQL_INSERT_UNIQUE_CODE, [strRes, strRes]);
            if (rows.affectedRows === 1) {
                return strRes;
            }
        }
        throw new Error('Max attempts to generate a code!');
    }


    static resError(err, res) {
        // mysql errors
        if (err.code && err.errno) {
            console.log(err);
            if (err.errno === -4078) {                
                res.status(500).send({message: `Couldn't stabilish a database connection!`});
            } else {
                res.status(500).send({message: `Internal database error. Please see the logs!`});
            }            
        } else if (err instanceof BaseError) {
            res.status(err.httpCode).send({message: err.message});
        }
        else {
            console.log(err);
            res.status(500).send({message: `Internal server error. Please see the logs!`});            
        }
        
    }

    static strIsValidDate(str) {        
        if (str.length === 10 || str.length === 19) {
            return !isNaN(Date.parse(str));
        }
        return false;
    }

    static addDays(baseDate, days) {
        return new Date(baseDate.getTime() + (86400000 * days));
    }

    static validateEmail(email) {        
        const emailExp = /\S+@\S+\.\S+/;
        return emailExp.test(email);          
    }

}

module.exports = UtilsLib;