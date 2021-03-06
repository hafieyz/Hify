'use-strict'

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

exports.sendNotification = functions.firestore.document("Users/{user_id}/Notifications/{notification_id}").onWrite((change,context)=> {

    const user_id         = context.params.user_id;
    const notification_id = context.params.notification_id;
    const db              = admin.firestore();

    return db.collection("Users").doc(user_id).collection("Notifications").doc(notification_id).get().then(queryResult=>{

        const from_user_id  = queryResult.data().from;
        const from_message  = queryResult.data().message;
        const noti_id       = queryResult.data().notification_id;
        const timestamp     = queryResult.data().timestamp;

        const from_data = db.collection("Users").doc(from_user_id).get();
        const to_data   = db.collection("Users").doc(user_id).get();
        let tokens;  // The array containing all the user's tokens.

        return Promise.all([from_data,to_data]).then(result=>{

            const from_name  = result[0].data().name;
            const from_image = result[0].data().image;
            const to_name    = result[1].data().name;
            const to_tokens  = result[1].data().token_ids;

            tokens = Object.keys(to_tokens).map(function(key) { 
                return to_tokens[key]; // Listing all tokens as an array.
              });
              
            const payload={
                data:{
                    notification_id:noti_id,
                    timestamp:timestamp,
                    message:from_message,
                    from_id:from_user_id,
                    from_name:from_name,
                    from_image:from_image,
                    title:from_name,
                    body:from_message,
                    click_action:"com.amsavarthan.hify.TARGETNOTIFICATION"
                }
            };
          
            console.log(" | from: " + from_name + " | to:" + to_name + " | message:" + from_message);
            
            // Send notifications to all tokens.
            return admin.messaging().sendToDevice(tokens, payload);
        }).then((response) => {
            // For each message check if there was an error.
            let tokensToRemove = [];
            response.results.forEach((result, index) => {
            const error = result.error;
                if (error) {
                    console.error('Failure sending notification to', tokens[index], error);
                    // Cleanup the tokens who are not registered anymore.
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(          toRef.update({token_ids: db.FieldValue.arrayRemove(tokens[index])})           );
                    }
                }
                else {
                    console.log("Successfully sent notification to: ", tokens[index], response);
                }
            });
            return Promise.all(tokensToRemove);
        });             
     });
});