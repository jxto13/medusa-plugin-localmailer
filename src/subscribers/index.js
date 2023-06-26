class OrderSubscriber {
    constructor({ notificationService }, options) {
        const templateMap = options.templateMap || {
            "order.placed": "orderplaced",
            "order.canceled" : "order.canceled", 
            "order.shipment_created" : "ordershipment_created",
            "customer.password_reset" : "customer.password_reset",
        };
        for (let key of Object.keys(templateMap)) {
            notificationService.subscribe(key, "nodemailer");
        }
    }
}

export default OrderSubscriber;
