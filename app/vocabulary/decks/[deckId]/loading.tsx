export default function VocabularyDeckLoading() {
  return (
    <main style={{ width: "100%", minHeight: "100vh", padding: "24px 20px 64px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ height: 170, borderRadius: 18, background: "#efede9", border: "1px solid rgba(0,0,0,.08)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 22 }}>
          {[0,1,2,3,4,5].map((index) => (
            <div key={index} style={{ height: 220, borderRadius: 15, background: "#efede9", border: "1px solid rgba(0,0,0,.08)" }} />
          ))}
        </div>
      </div>
    </main>
  );
}
