import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaImage,
  FaVideo,
  FaTrash,
  FaUpload,
  FaCheckCircle,
  FaTimesCircle,
  FaFileAlt,
  FaCalendarAlt,
  FaBullhorn,
  FaExclamationTriangle,
} from "react-icons/fa";
import { MdDeleteForever, MdAnnouncement } from "react-icons/md";

export default function AdminHome() {
  const [currentPost, setCurrentPost] = useState(null);
  const [form, setForm] = useState({
    kind: "image",
    file: null,
    caption: "",
    active: true,
  });
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const data = await apiFetch("/admin/posts");
    const posts = data.posts || [];
    const activePost = posts.find((post) => post.active === true);
    setCurrentPost(activePost || null);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.file) {
      alert("Please select a file to upload");
      return;
    }

    if (currentPost) {
      alert("Please delete the current active post before creating a new one.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("kind", form.kind);
      formData.append("file", form.file);
      formData.append("caption", form.caption);
      formData.append("active", form.active);

      await apiFetch("/admin/posts", {
        method: "POST",
        body: formData,
        headers: {},
        timeoutMs: 60000,
      });

      setForm({ kind: "image", file: null, caption: "", active: true });
      load();
    } catch (error) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error.message}. Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  const deleteCurrentPost = async () => {
    if (!currentPost) return;

    if (!confirm("Are you sure you want to delete the current active post?")) {
      return;
    }

    setDeleting(true);
    try {
      await apiFetch(`/admin/posts/${currentPost._id}`, {
        method: "DELETE",
      });
      setCurrentPost(null);
      load();
    } catch (error) {
      console.error("Delete failed:", error);
      alert(`Delete failed: ${error.message}. Please try again.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-md mx-auto px-4 pb-24 pt-16">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md px-4 py-3">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
                <MdAnnouncement className="text-yellow-400" size={14} />
              </div>
              <span className="text-white/70 text-xs font-medium">
                ADMIN PANEL
              </span>
            </div>
          </div>
        </div>

        {/* Create Post Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4 mb-4"
        >
          <h2 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
            <FaBullhorn className="text-pink-400" size={16} />
            Create Announcement
          </h2>

          <form onSubmit={submit} className="space-y-3">
            {/* Media Type & File Upload */}
            <div>
              <label className="text-white/60 text-xs font-medium mb-1 block">
                Media Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, kind: "image", file: null })
                  }
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
                    form.kind === "image"
                      ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                      : "bg-white/10 text-white/40 hover:text-white/60"
                  }`}
                >
                  <FaImage size={14} />
                  Image
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, kind: "video", file: null })
                  }
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
                    form.kind === "video"
                      ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                      : "bg-white/10 text-white/40 hover:text-white/60"
                  }`}
                >
                  <FaVideo size={14} />
                  Video
                </button>
              </div>
            </div>

            {/* File Input */}
            <div>
              <label className="text-white/60 text-xs font-medium mb-1 block">
                Select File
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept={form.kind === "image" ? "image/*" : "video/*"}
                  onChange={(e) =>
                    setForm({ ...form, file: e.target.files[0] })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm file:mr-2 file:py-1 file:px-3 file:rounded-full file:bg-emerald-500 file:text-white file:border-0 file:text-xs file:font-medium hover:file:bg-emerald-600 cursor-pointer"
                />
              </div>
              {form.file && (
                <div className="mt-1 text-emerald-400 text-[10px] flex items-center gap-1">
                  <FaCheckCircle size={10} />
                  Selected: {(form.file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>

            {/* Caption */}
            <div>
              <label className="text-white/60 text-xs font-medium mb-1 block">
                Message / Caption
              </label>
              <textarea
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
                placeholder="Write your announcement message here..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, active: !form.active })}
                className={`w-10 h-5 rounded-full transition-all ${
                  form.active ? "bg-emerald-500" : "bg-white/20"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-all ${
                    form.active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-white/60 text-xs">
                Make this post active immediately
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading || !form.file}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                uploading || !form.file
                  ? "bg-white/10 text-white/30 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg hover:scale-[1.02] active:scale-98"
              }`}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <FaUpload size={14} />
                  Post Announcement
                </div>
              )}
            </button>
          </form>
        </motion.div>

        {/* Current Active Post */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4"
        >
          <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
            Currently Active
          </h3>

          <AnimatePresence mode="wait">
            {currentPost ? (
              <motion.div
                key="post"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-3 border border-purple-500/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      {currentPost.kind === "image" ? (
                        <FaImage className="text-emerald-400" size={14} />
                      ) : (
                        <FaVideo className="text-emerald-400" size={14} />
                      )}
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">
                        {currentPost.kind.toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <FaCalendarAlt size={8} className="text-white/30" />
                        <span className="text-white/30 text-[9px]">
                          {new Date(currentPost.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-medium flex items-center gap-1">
                    <FaCheckCircle size={8} />
                    Active
                  </span>
                </div>

                <div className="bg-white/5 rounded-lg p-2 mb-2">
                  <p className="text-white/50 text-[11px] truncate">
                    📁{" "}
                    {currentPost.url || currentPost.filename || "File uploaded"}
                  </p>
                </div>

                {currentPost.caption && (
                  <div className="bg-white/5 rounded-lg p-2 mb-3">
                    <p className="text-white/60 text-[11px] leading-relaxed">
                      {currentPost.caption}
                    </p>
                  </div>
                )}

                <button
                  onClick={deleteCurrentPost}
                  disabled={deleting}
                  className="w-full py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium flex items-center justify-center gap-2 hover:bg-red-500/30 transition-all"
                >
                  {deleting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <MdDeleteForever size={14} />
                      Delete Post
                    </>
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                  <FaExclamationTriangle className="text-white/20" size={20} />
                </div>
                <p className="text-white/50 text-sm">No active post</p>
                <p className="text-white/30 text-xs mt-1">
                  Create your first announcement above
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
