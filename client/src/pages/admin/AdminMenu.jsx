import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { Spinner, Toast } from "../../components/ui.jsx";

export default function AdminMenu() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [newCat, setNewCat] = useState("");
  const [itemForm, setItemForm] = useState(null); // {categoryId, ...}

  const load = useCallback(async () => {
    const { data } = await api.get("/menu/admin/categories");
    setCategories(data.categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    await api.post("/menu/admin/categories", { name: newCat });
    setNewCat("");
    setToast("Category added");
    load();
  };

  const toggleCategory = async (c) => {
    await api.put(`/menu/admin/categories/${c.id}`, { active: !c.active });
    load();
  };

  const deleteCategory = async (c) => {
    if (!confirm(`Delete category "${c.name}" and all its items?`)) return;
    await api.delete(`/menu/admin/categories/${c.id}`);
    load();
  };

  const saveItem = async () => {
    const f = itemForm;
    if (!f.name || f.price === "") return setToast("Name and price required");
    try {
      if (f.id) {
        await api.put(`/menu/admin/items/${f.id}`, f);
      } else {
        await api.post("/menu/admin/items", f);
      }
      setItemForm(null);
      setToast("Saved");
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  const toggleItem = async (it) => {
    await api.put(`/menu/admin/items/${it.id}`, { available: !it.available });
    load();
  };

  const deleteItem = async (it) => {
    if (!confirm(`Delete "${it.name}"?`)) return;
    await api.delete(`/menu/admin/items/${it.id}`);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Menu Management</h1>

      <div className="card mb-6 flex gap-2 p-4">
        <input
          className="input"
          placeholder="New category name"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
        />
        <button className="btn-primary" onClick={addCategory}>
          Add Category
        </button>
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">
                {cat.name} {!cat.active && <span className="text-xs text-gray-400">(hidden)</span>}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary btn-sm"
                  onClick={() =>
                    setItemForm({ categoryId: cat.id, name: "", description: "", price: "", available: true })
                  }
                >
                  + Item
                </button>
                <button className="btn-outline btn-sm" onClick={() => toggleCategory(cat)}>
                  {cat.active ? "Hide" : "Show"}
                </button>
                <button className="btn-outline btn-sm text-red-600" onClick={() => deleteCategory(cat)}>
                  Delete
                </button>
              </div>
            </div>

            <div className="divide-y">
              {cat.items.length === 0 && <p className="py-3 text-sm text-gray-400">No items yet.</p>}
              {cat.items.map((it) => (
                <div key={it.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-medium ${!it.available ? "text-gray-400 line-through" : ""}`}>
                        {it.name}
                      </p>
                      {it.description && <p className="truncate text-xs text-gray-500">{it.description}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-brand">{money(it.price)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-outline btn-sm" onClick={() => toggleItem(it)}>
                      {it.available ? "In stock" : "Out of stock"}
                    </button>
                    <button
                      className="btn-outline btn-sm"
                      onClick={() =>
                        setItemForm({
                          id: it.id,
                          categoryId: cat.id,
                          name: it.name,
                          description: it.description || "",
                          price: Number(it.price),
                          photoUrl: it.photoUrl || "",
                          available: it.available,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button className="btn-outline btn-sm text-red-600" onClick={() => deleteItem(it)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Item modal */}
      {itemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-5">
            <h3 className="mb-3 text-lg font-bold">{itemForm.id ? "Edit Item" : "New Item"}</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Price</label>
                <input type="number" step="0.01" className="input" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
              </div>
              <div>
                <label className="label">Photo URL (optional)</label>
                <input className="input" value={itemForm.photoUrl || ""} onChange={(e) => setItemForm({ ...itemForm, photoUrl: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setItemForm(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={saveItem}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
