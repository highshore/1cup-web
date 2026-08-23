export default function VocabularyLoading() {
  return (
    <main style={{ width: "100%", minHeight: "100vh", padding: "24px 20px 64px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ width: 150, height: 28, borderRadius: 8, background: "#e8e6e2" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 18 }}>
          {[0,1,2,3].map((index) => (
            <div key={index} style={{ height: 142, borderRadius: 16, background: "#efede9", border: "1px solid rgba(0,0,0,.08)" }} />
          ))}
        </div>
      </div>
    </main>
  );
}
