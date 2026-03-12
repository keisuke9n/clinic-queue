"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

export default function StaffPage() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const fetchQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from("queue")
      .select("*")
      .eq("visit_date", today)
      .order("number", { ascending: true });

    if (!error && data) {
      setQueue(data);
    }
    setLoading(false);
  }, [today]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    const channel = supabase
      .channel("staff-queue-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  const currentCalled = queue.find((t) => t.status === "called");
  const waitingList = queue.filter((t) => t.status === "waiting");
  const doneList = queue.filter((t) => t.status === "done");
  const otherList = queue.filter(
    (t) => t.status === "skipped" || t.status === "cancel"
  );

  const callNext = async () => {
    if (currentCalled) {
      await supabase
        .from("queue")
        .update({ status: "done" })
        .eq("id", currentCalled.id);
    }
    if (waitingList.length > 0) {
      await supabase
        .from("queue")
        .update({ status: "called" })
        .eq("id", waitingList[0].id);
    }
  };

  const markDone = async () => {
    if (!currentCalled) return;
    await supabase
      .from("queue")
      .update({ status: "done" })
      .eq("id", currentCalled.id);
  };

  const skip = async () => {
    if (!currentCalled) return;
    await supabase
      .from("queue")
      .update({ status: "skipped" })
      .eq("id", currentCalled.id);
  };

  const cancel = async () => {
    if (!currentCalled) return;
    await supabase
      .from("queue")
      .update({ status: "cancel" })
      .eq("id", currentCalled.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              スタッフ管理画面
            </h1>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("ja-JP")} ・ 全{queue.length}件
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-500">
              待機{" "}
              <span className="text-emerald-600 font-bold">
                {waitingList.length}
              </span>
            </span>
            <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-500">
              完了{" "}
              <span className="text-green-600 font-bold">
                {doneList.length}
              </span>
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">
            {currentCalled ? "現在呼出中" : "呼出中の患者はいません"}
          </p>

          {currentCalled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-3xl font-extrabold">
                  {currentCalled.number}
                </div>
                <span className="inline-block bg-purple-100 text-purple-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                  呼出中
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={markDone}
                  className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition"
                >
                  ✓ 完了
                </button>
                <button
                  onClick={skip}
                  className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition"
                >
                  → スキップ
                </button>
                <button
                  onClick={cancel}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition"
                >
                  ✕ 取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={callNext}
              disabled={waitingList.length === 0}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-40"
            >
              ▶ 次の患者を呼び出す
            </button>
          )}
        </div>

        {currentCalled && (
          <button
            onClick={callNext}
            disabled={waitingList.length === 0}
            className="w-full py-3.5 mb-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-40"
          >
            ▶▶ 次の患者を呼び出す（現在を完了して次へ）
          </button>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
          <p className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            待機中 ({waitingList.length})
          </p>
          {waitingList.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-5">
              待機中の患者はいません
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {waitingList.map((t, i) => (
                <div
                  key={t.id}
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold ${
                    i === 0
                      ? "bg-emerald-50 text-emerald-600 border-2 border-emerald-500"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  {t.number}
                </div>
              ))}
            </div>
          )}
        </div>

        {(doneList.length > 0 || otherList.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-bold text-gray-400 mb-3">履歴</p>
            <div className="flex flex-wrap gap-2">
              {[...doneList, ...otherList]
                .sort((a, b) => a.number - b.number)
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-500"
                  >
                    {t.number}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        t.status === "done"
                          ? "bg-green-100 text-green-600"
                          : t.status === "skipped"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {t.status === "done"
                        ? "完了"
                        : t.status === "skipped"
                        ? "スキップ"
                        : "取消"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600 underline">
            患者画面に戻る
          </a>
        </div>
      </div>
    </div>
  );
}