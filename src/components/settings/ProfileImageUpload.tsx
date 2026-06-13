import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";

interface ProfileImageUploadProps {
  currentUrl: string | null;
  userId: string;
  type: "avatar" | "logo";
  onUpload: (url: string) => void;
  fallback?: string;
  size?: "sm" | "md" | "lg";
}

export function ProfileImageUpload({
  currentUrl,
  userId,
  type,
  onUpload,
  fallback = "?",
  size = "md",
}: ProfileImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const avatarSizeClasses = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-28 w-28",
  };

  const logoContainerClasses = {
    sm: "h-12 min-w-20 max-w-32",
    md: "h-16 min-w-24 max-w-48",
    lg: "h-20 min-w-32 max-w-64",
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: t("settings.invalidFileTypeTitle"),
        description: t("settings.invalidFileTypeDesc"),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("settings.fileTooLargeTitle"),
        description: t("settings.fileTooLargeDesc"),
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("profile-assets")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("profile-assets")
        .getPublicUrl(filePath);

      onUpload(publicUrl);

      toast({
        title: t("settings.uploadedTitle"),
        description: type === "avatar" ? t("settings.avatarUpdatedDesc") : t("settings.logoUpdatedDesc"),
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: t("settings.uploadErrorTitle"),
        description: t("settings.uploadErrorDesc"),
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onUpload("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayUrl = previewUrl || currentUrl;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {type === "logo" ? (
          // Logo display - rectangular container, preserves aspect ratio
          <div className={`flex items-center justify-center p-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 ${logoContainerClasses[size]}`}>
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={t("settings.companyLogoAlt")}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-muted-foreground text-xs text-center px-2">{t("settings.noLogo")}</span>
            )}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        ) : (
          // Avatar display - circular
          <>
            <Avatar className={avatarSizeClasses[size]}>
              <AvatarImage src={displayUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {fallback}
              </AvatarFallback>
            </Avatar>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {type === "avatar" ? t("settings.uploadImage") : t("settings.uploadLogo")}
        </Button>
        {displayUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isUploading}
            className="text-muted-foreground"
          >
            <X className="mr-2 h-4 w-4" />
            {t("settings.remove")}
          </Button>
        )}
      </div>
    </div>
  );
}
