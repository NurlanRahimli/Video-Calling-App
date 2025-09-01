"use client";
import DailyIframe from "@daily-co/daily-js";

let callObject = null;

export function getDailyCall() {
    if (!callObject) callObject = DailyIframe.createCallObject();
    return callObject;
}

export function destroyDailyCall() {
    if (callObject?.destroy) callObject.destroy();
    callObject = null;
}
