import { useEffect, useState } from "react";
import api from "../services/api";
import { resolveMediaUrl } from "../utils/mediaUrl";
import "./Watch.css";

export default function Watch() {
  const [categories, setCategories] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [items, setItems] = useState({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemImage, setNewItemImage] = useState(null);

  const fetchCategories = async () => {
    const res = await api.get("/watch/categories");
    setCategories(res.data.data);
  };

  const fetchItems = async (categoryId) => {
    const res = await api.get(`/watch/items/${categoryId}`);

    setItems((prev) => ({
      ...prev,
      [categoryId]: res.data.data,
    }));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleCategory = (id) => {
    if (expandedCategory === id) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(id);
      fetchItems(id);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;

    await api.post(
      "/watch/categories",
      new URLSearchParams({ name: newCategoryName })
    );

    setNewCategoryName("");
    setShowCategoryModal(false);
    fetchCategories();
  };

  const createItem = async () => {
    if (!newItemName.trim() || !selectedCategoryId) return;

    const formData = new FormData();
    formData.append("category_id", selectedCategoryId);
    formData.append("name", newItemName);

    if (newItemImage) {
      formData.append("image", newItemImage);
    }

    await api.post("/watch/items", formData);

    setNewItemName("");
    setNewItemImage(null);
    setShowItemModal(false);
    fetchItems(selectedCategoryId);
  };

  const markWatched = async (itemId, categoryId) => {
    await api.patch(`/watch/items/${itemId}/watched`);
    fetchItems(categoryId);
  };

  return (
    <div className="watch-page">
      <div className="watch-container glass-strong">
        <div className="watch-header">
          <h1>Assistir</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCategoryModal(true)}
          >
            + Categoria
          </button>
        </div>

        <div className="category-list">
          {categories.map((category) => (
            <div key={category.id} className="category-block">
              <div
                className="category-header"
                onClick={() => toggleCategory(category.id)}
              >
                <span>{category.name}</span>
                <span className="arrow">
                  {expandedCategory === category.id ? "▼" : "▶"}
                </span>
              </div>

              {expandedCategory === category.id && (
                <div className="items-grid">
                  <button
                    className="btn btn-secondary add-item-btn"
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setShowItemModal(true);
                    }}
                  >
                    + Adicionar
                  </button>

                  {items[category.id]?.map((item) => (
                    <div
                      key={item.id}
                      className={`watch-card ${
                        item.watched_at ? "watched" : ""
                      }`}
                    >
                      <div className="watch-image">
                        {item.image_path ? (
                          <img
                            src={resolveMediaUrl(item.image_path)}
                            alt={item.name}
                          />
                        ) : (
                          <div className="placeholder">🎬</div>
                        )}
                      </div>

                      <div className="watch-meta">
                        <span>{item.name}</span>

                        {item.watched_at && (
                          <small>
                            Assistido em {" "}
                            {new Date(item.watched_at).toLocaleDateString()}
                          </small>
                        )}
                      </div>

                      {!item.watched_at && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() =>
                            markWatched(item.id, category.id)
                          }
                        >
                          Marcar como assistido
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Nova Categoria</h3>
            <input
              type="text"
              placeholder="Nome"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="input"
            />
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowCategoryModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={createCategory}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Novo Item</h3>
            <input
              type="text"
              placeholder="Nome"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="input"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewItemImage(e.target.files[0])}
              className="input"
            />
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowItemModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={createItem}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
