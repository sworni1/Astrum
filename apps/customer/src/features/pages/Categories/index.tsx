import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { categoryList } from "../../../common/constants/category.list";
import { Alert } from "../../../components/ui/alert";

const Categories = async () => {
  const t = await getTranslations("catalog");

  return (
    <section className="py-8 antialiased md:py-16">
      <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        <div className="mb-4 flex items-center justify-between gap-4 md:mb-8">
          <h2 className="text-xl font-semibold sm:text-2xl">
            {t("title")}
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {categoryList.map((category, idx) => (
            <Link key={idx} href={`/categories/${category.href}`}>
              <Alert className="max-w-full h-[38px] cursor-pointer flex items-center">
                {category.name}
              </Alert>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
