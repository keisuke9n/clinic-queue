"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

export default function MonitorPage() {
  const [currentCalled, setCurrentCalled] = useState<number | null>(null);
  const [waitingList, setWaitingList] = useState<number[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [time, setTime] = useState(new Date());

  const today = new Date().toISOString().slice(0, 10);

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from("queue")
      .select("*")
      .eq("visit_date", today)
      .order("number", { ascending: true });

    if (data) {
      const called = data.find((t) => t.status === "called");
      setCurrentCalled(called?.number ?? null);
      setWaitingList(
        data.filter((t) => t.status === "waiting").map((t) => t.number)
      );
      setDoneCount(data.filter((t) => t.status === "done").length);
    }
  }, [today]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // リアルタイム更新
  useEffect(() => {
    const channel = supabase
      .channel("monitor-queue")
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

  // 時計
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-10 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold tracking-wide">受付案内</h1>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold">
            {time.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex">
        {/* 左：現在の呼び出し番号 */}
        <div className="flex-1 flex flex-col items-center justify-center border-r border-gray-800 px-10">
          <p className="text-xl font-semibold text-gray-400 tracking-widest uppercase mb-6">
            現在の診察番号
          </p>
          {currentCalled ? (
            <div className="relative">
              <p className="text-[12rem] font-extrabold leading-none tracking-tight text-emerald-400">
                {currentCalled}
              </p>
              <span className="absolute -top-4 -right-4 w-6 h-6 bg-emerald-400 rounded-full animate-ping" />
            </div>
          ) : (
            <p className="text-6xl font-bold text-gray-600">—</p>
          )}
          <p className="text-lg text-gray-500 mt-8">
            番号が表示されましたら受付へお越しください
          </p>
        </div>

        {/* 右：待機リスト */}
        <div className="w-80 flex flex-col px-8 py-8">
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-400 tracking-widest uppercase mb-1">
              お待ちの方
            </p>
            <p className="text-4xl font-bold text-white">
              {waitingList.length}
              <span className="text-lg text-gray-400 ml-2">名</span>
            </p>
          </div>

          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">
              次にお呼びする番号
            </p>
            <div className="space-y-2">
              {waitingList.slice(0, 8).map((num, i) => (
                <div
                  key={num}
                  className={`flex items-center gap-4 px-5 py-3 rounded-xl ${
                    i === 0
                      ? "bg-emerald-900/50 border border-emerald-700"
                      : "bg-gray-800/50"
                  }`}
                >
                  <span
                    className={`text-2xl font-bold font-mono ${
                      i === 0 ? "text-emerald-400" : "text-gray-300"
                    }`}
                  >
                    {num}
                  </span>
                  {i === 0 && (
                    <span className="text-xs font-semibold text-emerald-400">
                      次
                    </span>
                  )}
                </div>
              ))}
              {waitingList.length > 8 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  他 {waitingList.length - 8} 名
                </p>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 mt-6">
            <p className="text-xs text-gray-500">
              本日の診察済み:{" "}
              <span className="text-white font-bold">{doneCount}名</span>
            </p>
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="px-10 py-4 border-t border-gray-800 text-center">
        <p className="text-sm text-gray-500">
          スマートフォンからも順番を確認できます
        </p>
      </div>
    </div>
  );
}