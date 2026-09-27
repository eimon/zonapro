"use client";

import { api } from "@/lib/api";
import { ImageUploadField } from "@/components/image-upload-field";

export function SupplyImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  return <ImageUploadField value={value} onChange={onChange} uploadImage={api.supplies.uploadImage} />;
}
