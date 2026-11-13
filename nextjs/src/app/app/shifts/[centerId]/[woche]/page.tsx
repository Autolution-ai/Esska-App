"use client";

import React from "react";
import { useParams } from "next/navigation";
import WocheEditor from "@/components/esska/WocheEditor";

export default function WocheEditorPage() {
    const params = useParams<{ centerId: string; woche: string }>();
    return <WocheEditor centerId={params.centerId} woche={params.woche} />;
}
