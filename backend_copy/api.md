ws://localhost:8080/api/chat/sendMessage(method:ws)
PARAMS
{"message":"123",
"sender":"1",
"receiver":"1",
"senderIdentity":"doctor",
"receiverIdentity":"patient"}
RES
{"chatMessage": {
"message": "123",
"timestamp": "2023-10-25 23:22:55",
"sender": "2",
"receiver": "2",
"senderIdentity": "doctor",
"receiverIdentity": "patient"
},
"conversationId": "6058803e-7746-490d-adc8-4bb8be69eaa3"}

https://e-react-node-backend-22ed6864d5f3.herokuapp.com/api/chat/getConversationIdByUserIdentity?sender=1&senderIdentity=doctor&receiver=1&receiverIdentity=patient(method:httpget)
RES
{
"conversation_id": "de606cb2-5126-4746-8aa6-ce4b74e57625"
}

https://e-react-node-backend-22ed6864d5f3.herokuapp.com/api/chat/getChatHistoryByConversationId?conversationId=6058803e-7746-490d-adc8-4bb8be69eaa3
RES
[
{
"id": 9,
"conversation_id": "6058803e-7746-490d-adc8-4bb8be69eaa3",
"sender": 2,
"receiver": 2,
"sender_identity": "doctor",
"time": "2023-10-26T03:22:55.000Z",
"message": "123",
"receiver_identity": "patient"
},
{
"id": 10,
"conversation_id": "6058803e-7746-490d-adc8-4bb8be69eaa3",
"sender": 2,
"receiver": 2,
"sender_identity": "doctor",
"time": "2023-10-26T03:33:28.000Z",
"message": "123",
"receiver_identity": "patient"
},
{
"id": 14,
"conversation_id": "6058803e-7746-490d-adc8-4bb8be69eaa3",
"sender": 2,
"receiver": 2,
"sender_identity": "doctor",
"time": "2023-10-26T03:36:17.000Z",
"message": "123",
"receiver_identity": "patient"
},
{
"id": 15,
"conversation_id": "6058803e-7746-490d-adc8-4bb8be69eaa3",
"sender": 2,
"receiver": 2,
"sender_identity": "doctor",
"time": "2023-10-26T03:36:27.000Z",
"message": "123",
"receiver_identity": "patient"
}
]
